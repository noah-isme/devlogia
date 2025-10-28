import type { Post } from "@prisma/client";

import { averageVectors, cosineSimilarity, deserializeVector, generateEmbedding, serializeVector } from "@/lib/ai/embeddings";
import { logger } from "@/lib/logger";
import { initRedis } from "@/lib/redis";

const DEFAULT_LIMIT = 5;
const CACHE_TTL = Number(process.env.RECOMMENDER_CACHE_TTL ?? 3600);

type PostWithEmbedding = Post & {
  embedding?: {
    id: string;
    vector: unknown;
    model: string;
    provider: string;
    dimension: number;
    updatedAt: Date;
  } | null;
  tags: Array<{ tag: { name: string } }>;
};

type RecommendationResult = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  score: number;
  publishedAt: string | null;
  tags: string[];
};

type RecommendationResponse = {
  items: RecommendationResult[];
  generatedAt: string;
  latencyMs: number;
  cache: "hit" | "miss";
  fallback: boolean;
};

function buildCacheKey(params: { postId?: string | null; query?: string | null; preferences?: string[] | null; limit: number }) {
  const parts = ["recommend:v2"];
  if (params.postId) parts.push(`post:${params.postId}`);
  if (params.query) parts.push(`query:${params.query.toLowerCase()}`);
  if (params.preferences?.length) parts.push(`pref:${params.preferences.sort().join(",")}`);
  parts.push(`limit:${params.limit}`);
  return parts.join(":");
}

function normalizePreference(preference: string) {
  return preference.toLowerCase().trim();
}

function scoreByPreference(tags: string[], preferences: string[]) {
  if (!preferences.length) return 0;
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  let score = 0;
  for (const preference of preferences) {
    if (normalizedTags.includes(preference)) {
      score += 0.05;
    }
  }
  return score;
}

export async function regenerateEmbeddingsForPosts(postIds?: string[]) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    logger.warn("Database disabled. Skipping embedding regeneration.");
    return { generated: 0, skipped: 0 };
  }

  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      ...(postIds?.length ? { id: { in: postIds } } : {}),
    },
    include: {
      embedding: true,
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  let generated = 0;
  let skipped = 0;

  for (const post of posts) {
    const needsEmbedding = !post.embedding || post.embedding.updatedAt < post.updatedAt;
    if (!needsEmbedding) {
      skipped += 1;
      continue;
    }

    const text = [post.title, post.summary ?? "", post.contentMdx.slice(0, 4000)].join("\n\n");
    const embedding = await generateEmbedding(text);
    await prisma.embedding.upsert({
      where: { postId: post.id },
      create: {
        postId: post.id,
        dimension: embedding.vector.length,
        model: embedding.model,
        provider: embedding.provider,
        vector: serializeVector(embedding.vector),
      },
      update: {
        dimension: embedding.vector.length,
        model: embedding.model,
        provider: embedding.provider,
        vector: serializeVector(embedding.vector),
      },
    });

    await prisma.recommendationSnapshot.create({
      data: {
        embedding: { connect: { postId: post.id } },
        metadata: {
          postId: post.id,
          tags: post.tags.map((entry) => entry.tag.name),
          regeneratedAt: new Date().toISOString(),
        },
      },
    });

    generated += 1;
  }

  return { generated, skipped };
}

function buildPostFeatureVector(post: PostWithEmbedding) {
  const baseVector = deserializeVector(post.embedding?.vector ?? []);
  if (!baseVector.length) {
    return baseVector;
  }
  const preferenceVectors: number[][] = [];
  if (post.tags.length) {
    const tagVector = averageVectors(
      post.tags.map((entry, index) => {
        const weight = 1 - index * 0.05;
        return baseVector.map((value) => value * clamp(weight, 0.5, 1));
      }),
    );
    if (tagVector.length) {
      preferenceVectors.push(tagVector);
    }
  }
  if (!preferenceVectors.length) {
    return baseVector;
  }
  return averageVectors([baseVector, ...preferenceVectors]);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function fetchEmbeddings() {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    return [] as PostWithEmbedding[];
  }
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: {
      embedding: true,
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
  return posts as PostWithEmbedding[];
}

export async function rebuildRecommendations(limit = DEFAULT_LIMIT) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    logger.warn("Database disabled. Skipping recommendation rebuild.");
    return { updated: 0 };
  }

  const posts = await fetchEmbeddings();
  const vectors = posts.map((post) => ({
    post,
    vector: buildPostFeatureVector(post),
  }));

  const recommendations: Array<{ source: string; target: string; score: number }> = [];

  for (let i = 0; i < vectors.length; i += 1) {
    const source = vectors[i];
    if (!source.vector.length) {
      continue;
    }
    const candidates: Array<{ target: string; score: number }> = [];
    for (let j = 0; j < vectors.length; j += 1) {
      if (i === j) continue;
      const target = vectors[j];
      if (!target.vector.length) continue;
      const score = cosineSimilarity(source.vector, target.vector);
      if (!Number.isFinite(score) || score <= 0) continue;
      candidates.push({ target: target.post.id, score });
    }
    candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .forEach((candidate) => {
        recommendations.push({ source: source.post.id, target: candidate.target, score: candidate.score });
      });
  }

  const uniqueSources = Array.from(new Set(recommendations.map((rec) => rec.source)));
  await prisma.$transaction([
    prisma.recommendation.deleteMany({ where: { sourcePostId: { in: uniqueSources } } }),
    ...recommendations.map((rec) =>
      prisma.recommendation.create({
        data: {
          sourcePostId: rec.source,
          targetPostId: rec.target,
          score: rec.score,
        },
      }),
    ),
  ]);

  return { updated: recommendations.length };
}

function mapPost(post: Post & { tags: Array<{ tag: { name: string } }> }, score: number): RecommendationResult {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    tags: post.tags.map((entry) => entry.tag.name),
    score,
  };
}

async function buildFallback(limit: number) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    return [] as RecommendationResult[];
  }
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { tags: { include: { tag: { select: { name: true } } } } },
  });
  return posts.map((post) => mapPost(post, 0.1));
}

async function fetchRecommendationsFromDb(postId: string, limit: number) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    return [];
  }
  const records = await prisma.recommendation.findMany({
    where: { sourcePostId: postId },
    orderBy: { score: "desc" },
    take: limit,
    include: {
      target: {
        include: { tags: { include: { tag: { select: { name: true } } } } },
      },
    },
  });
  return records.map((record) => mapPost(record.target, record.score));
}

async function computeOnTheFly(
  sourceVector: number[] | null,
  limit: number,
  preferences: string[],
): Promise<RecommendationResult[]> {
  const posts = await fetchEmbeddings();
  if (!posts.length) {
    return [];
  }

  const normalizedPrefs = preferences.map(normalizePreference).filter(Boolean);
  const items: RecommendationResult[] = [];
  let baseVector: number[] | null = sourceVector;

  if (!baseVector) {
    baseVector = averageVectors(
      posts
        .map((post) => buildPostFeatureVector(post))
        .filter((vector) => vector.length),
    );
  }

  if (!baseVector || !baseVector.length) {
    return [];
  }

  for (const post of posts) {
    const vector = buildPostFeatureVector(post);
    if (!vector.length) continue;
    const similarity = cosineSimilarity(baseVector, vector);
    if (!Number.isFinite(similarity) || similarity <= 0) continue;
    const preferenceBoost = scoreByPreference(post.tags.map((entry) => entry.tag.name), normalizedPrefs);
    const score = similarity + preferenceBoost;
    items.push({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      tags: post.tags.map((entry) => entry.tag.name),
      score,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function getRecommendations(params: {
  postId?: string | null;
  query?: string | null;
  limit?: number;
  userPreferences?: string[];
  useCache?: boolean;
}): Promise<RecommendationResponse> {
  const limit = clamp(Number(params.limit ?? DEFAULT_LIMIT), 1, 10);
  const redis = params.useCache === false ? null : await initRedis();
  const cacheKey = redis ? buildCacheKey({
    postId: params.postId,
    query: params.query,
    preferences: params.userPreferences ?? null,
    limit,
  }) : null;

  const started = Date.now();

  if (redis && cacheKey) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as RecommendationResponse;
      return { ...parsed, latencyMs: Date.now() - started, cache: "hit" };
    }
  }

  let items: RecommendationResult[] = [];
  let fallback = false;

  if (params.postId) {
    items = await fetchRecommendationsFromDb(params.postId, limit);
  }

  let sourceVector: number[] | null = null;

  if ((!items.length && params.postId) || params.query) {
    if (params.postId) {
      const prismaModule = await import("@/lib/prisma");
      const { prisma, isDatabaseEnabled } = prismaModule;
      if (isDatabaseEnabled) {
        const post = await prisma.embedding.findUnique({ where: { postId: params.postId } });
        if (post) {
          sourceVector = deserializeVector(post.vector);
        }
      }
    }
    if (params.query) {
      const embedding = await generateEmbedding(params.query);
      sourceVector = embedding.vector;
    }

    const computed = await computeOnTheFly(sourceVector, limit, params.userPreferences ?? []);
    if (computed.length) {
      items = computed;
    }
  }

  if (!items.length) {
    fallback = true;
    items = await buildFallback(limit);
  }

  const response: RecommendationResponse = {
    items,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    cache: "miss",
    fallback,
  };

  if (redis && cacheKey) {
    await redis.set(cacheKey, JSON.stringify(response), "EX", CACHE_TTL);
  }

  return response;
}
