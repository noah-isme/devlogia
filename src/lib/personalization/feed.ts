import { logger } from "@/lib/logger";
import { recordAuditLog } from "@/lib/ai/guardrails";
import { initRedis } from "@/lib/redis";
import {
  type PersonalizedFeedItem,
  type PersonalizedFeedOptions,
  type PersonalizedFeedResponse,
} from "@/lib/personalization/types";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { clamp } from "@/lib/utils";

const DEFAULT_FEED_LIMIT = 8;

function buildCacheKey(options: PersonalizedFeedOptions) {
  const ttlHours = Number(process.env.AI_PERSONALIZATION_TTL_HOURS ?? "6");
  const version = 3;
  const parts = [
    `feed:v${version}`,
    `limit:${options.limit ?? DEFAULT_FEED_LIMIT}`,
    `fallback:${options.fallbackLimit ?? 6}`,
    options.userId ? `user:${options.userId}` : "anon",
    options.contextPostId ? `context:${options.contextPostId}` : "none",
    `ttl:${ttlHours}`,
  ];
  return parts.join(":");
}

async function loadFallbackPosts(limit: number): Promise<PersonalizedFeedItem[]> {
  if (!isDatabaseEnabled) {
    return [];
  }
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    include: { tags: { include: { tag: true } } },
  });
  return posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    tags: post.tags.map(({ tag }) => tag.name),
    score: 0.25,
    reason: ["Trending"],
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
  } satisfies PersonalizedFeedItem));
}

export async function getPersonalizedFeed(
  options: PersonalizedFeedOptions,
): Promise<PersonalizedFeedResponse> {
  const startedAt = Date.now();
  const limit = clamp(Number(options.limit ?? DEFAULT_FEED_LIMIT), 3, 20);
  const fallbackLimit = clamp(Number(options.fallbackLimit ?? Math.max(6, limit)), limit, 30);
  const cacheKey = buildCacheKey({ ...options, limit, fallbackLimit });
  const redis = await initRedis();
  const bypassCache = Boolean(options.forceRefresh);

  if (redis && !bypassCache) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PersonalizedFeedResponse;
        return { ...parsed, cache: "hit", latencyMs: Date.now() - startedAt } satisfies PersonalizedFeedResponse;
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed to read personalized feed cache");
    }
  }

  if (!isDatabaseEnabled) {
    const fallback = await loadFallbackPosts(fallbackLimit);
    return {
      items: fallback,
      cache: "bypass",
      fallback: true,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    } satisfies PersonalizedFeedResponse;
  }

  if (!options.userId) {
    const fallback = await loadFallbackPosts(fallbackLimit);
    return {
      items: fallback,
      cache: "bypass",
      fallback: true,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    } satisfies PersonalizedFeedResponse;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: options.userId },
    include: {
      affinities: {
        orderBy: { affinity: "desc" },
        take: limit * 3,
        include: { contentVector: { include: { post: { include: { tags: { include: { tag: true } } } } } } },
      },
    },
  });

  if (!profile || profile.personalizationOptOut) {
    const fallback = await loadFallbackPosts(fallbackLimit);
    return {
      items: fallback,
      cache: "miss",
      fallback: true,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      segment: profile?.segment ?? undefined,
    } satisfies PersonalizedFeedResponse;
  }

  const contextPostId = options.contextPostId ?? null;
  const candidates: PersonalizedFeedItem[] = [];
  for (const affinity of profile.affinities) {
    const vector = affinity.contentVector;
    const post = vector?.post;
    if (!post || post.status !== "PUBLISHED") continue;
    if (contextPostId && post.id === contextPostId) {
      continue;
    }
    candidates.push({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      score: affinity.affinity,
      reason: Array.isArray(affinity.reason)
        ? (affinity.reason as string[])
        : ["Personalized"],
      publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
      tags: post.tags.map(({ tag }) => tag.name),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = candidates.slice(0, limit);
  let fallbackUsed = false;

  if (selected.length < limit) {
    const needed = limit - selected.length;
    const fallback = await loadFallbackPosts(Math.max(needed, limit));
    fallbackUsed = true;
    for (const item of fallback) {
      if (selected.some((entry) => entry.id === item.id)) {
        continue;
      }
      selected.push({ ...item, score: Math.max(item.score, 0.2) });
      if (selected.length >= limit) break;
    }
  }

  const response: PersonalizedFeedResponse = {
    items: selected,
    cache: "miss",
    fallback: fallbackUsed,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    segment: profile.segment ?? undefined,
  };

  if (redis && !bypassCache) {
    const ttlHours = Number(process.env.AI_PERSONALIZATION_TTL_HOURS ?? "6");
    const ttlSeconds = clamp(Math.round(ttlHours * 60 * 60), 600, 24 * 60 * 60);
    try {
      await redis.set(cacheKey, JSON.stringify(response), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ err: error }, "Failed to cache personalized feed");
    }
  }

  try {
    await recordAuditLog({
      userId: options.userId,
      postId: null,
      task: "feed",
      prompt: `feed:personal limit=${limit} segment=${profile.segment ?? "unknown"}`,
      model: process.env.AI_MODEL_RECOMMENDER ?? process.env.AI_MODEL ?? "gpt-4o-mini",
      provider: process.env.AI_PROVIDER ?? "none",
      tokens: 0,
      moderated: false,
    });
  } catch (error) {
    logger.warn({ err: error }, "Failed to log personalized feed audit");
  }

  return response;
}
