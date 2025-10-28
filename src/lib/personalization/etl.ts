import { Prisma } from "@prisma/client";

import { mapAuditLogToTelemetry } from "@/lib/analytics/insights";
import { deserializeVector, serializeVector } from "@/lib/ai/embeddings";
import { recordAuditLog } from "@/lib/ai/guardrails";
import { logger } from "@/lib/logger";
import {
  blendHighlights,
  buildFeatureVector,
  calculateEngagementScore,
  calculateFreshnessScore,
  computeProfileSnapshot,
  determineTonePreference,
  scoreAffinity,
  scoreTopicPreferences,
} from "@/lib/personalization/metrics";
import type {
  AffinityScore,
  ContentVectorSnapshot,
  UserEngagementEvent,
  UserProfileSnapshot,
} from "@/lib/personalization/types";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { clamp } from "@/lib/utils";

const TELEMETRY_ACTIONS = [
  "telemetry:page-session",
  "telemetry:page-view",
  "telemetry:share",
  "telemetry:feedback",
] as const;

const MAX_AFFINITIES = 60;

function resolveCutoffDays(): number {
  const env = Number(process.env.ANALYTICS_TTL_DAYS ?? "90");
  if (Number.isFinite(env) && env > 0) {
    return env;
  }
  return 90;
}

function extractSlug(input?: string | null) {
  if (!input) return null;
  const normalized = input.replace(/^https?:\/\/[^/]+/, "");
  const match = /blog\/([^/?#]+)/.exec(normalized) ?? /posts\/([^/?#]+)/.exec(normalized);
  return match?.[1] ?? normalized.replace(/^\//, "");
}

type RunInsightEtlOptions = {
  refreshAffinities?: boolean;
  skipAuditLog?: boolean;
};

type RunInsightEtlResult = {
  profiles: number;
  contentVectors: number;
  affinities: number;
  durationMs: number;
  errors: number;
};

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export async function runInsightEtl(options: RunInsightEtlOptions = {}): Promise<RunInsightEtlResult> {
  const startedAt = Date.now();
  if (!isDatabaseEnabled) {
    logger.warn("Database disabled — skipping insight ETL");
    return { profiles: 0, contentVectors: 0, affinities: 0, durationMs: 0, errors: 0 };
  }

  const cutoffDays = resolveCutoffDays();
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);

  const [posts, auditLogs, aiUsage, existingProfiles] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      include: {
        author: true,
        tags: { include: { tag: true } },
        embedding: true,
      },
    }),
    prisma.auditLog.findMany({
      where: {
        action: { in: [...TELEMETRY_ACTIONS] },
        createdAt: { gte: cutoff },
        userId: { not: null },
      },
      select: { id: true, userId: true, action: true, createdAt: true, meta: true },
    }),
    prisma.aIUsage.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { userId: true, task: true },
    }),
    prisma.userProfile.findMany({}),
  ]);

  const slugToPost = new Map(posts.map((post) => [post.slug, post]));
  const tagsByPost = new Map<string, string[]>();
  for (const post of posts) {
    const tags = post.tags.map(({ tag }) => tag.name.toLowerCase());
    tagsByPost.set(post.id, tags);
  }

  const usageByUser = new Map<string, string[]>();
  for (const usage of aiUsage) {
    if (!usage.userId) continue;
    const list = usageByUser.get(usage.userId) ?? [];
    list.push(usage.task);
    usageByUser.set(usage.userId, list);
  }

  const profileByUser = new Map(existingProfiles.map((profile) => [profile.userId, profile]));

  const eventsByUser = new Map<string, UserEngagementEvent[]>();
  const eventsByPost = new Map<string, UserEngagementEvent[]>();

  for (const log of auditLogs) {
    if (!log.userId) continue;
    const telemetry = mapAuditLogToTelemetry({ action: log.action, createdAt: log.createdAt, meta: log.meta });
    if (!telemetry) continue;
    if (telemetry.type === "unknown") {
      continue;
    }
    const slug = telemetry.slug ?? extractSlug(telemetry.page);
    const post = slug ? slugToPost.get(slug) : null;
    const postId = post?.id ?? null;
    const event: UserEngagementEvent = {
      userId: log.userId,
      postId,
      slug,
      type: telemetry.type,
      durationSeconds: telemetry.durationSeconds,
      maxScrollPercent: telemetry.maxScrollPercent,
      createdAt: telemetry.createdAt,
    };
    const userEvents = eventsByUser.get(log.userId) ?? [];
    userEvents.push(event);
    eventsByUser.set(log.userId, userEvents);
    if (postId) {
      const postEvents = eventsByPost.get(postId) ?? [];
      postEvents.push(event);
      eventsByPost.set(postId, postEvents);
    }
  }

  const contentVectors = new Map<string, ContentVectorSnapshot>();
  let contentVectorUpdates = 0;
  let errorCount = 0;

  for (const post of posts) {
    try {
      const vector = deserializeVector(post.embedding?.vector ?? []);
      const engagementEvents = eventsByPost.get(post.id) ?? [];
      const engagementScore = calculateEngagementScore(engagementEvents);
      const freshnessScore = calculateFreshnessScore(post.publishedAt ?? post.createdAt);
      const summary = post.summary ?? post.contentMdx.slice(0, 600);
      const highlights = blendHighlights(summary);
      const snapshot: ContentVectorSnapshot = {
        postId: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        tags: tagsByPost.get(post.id) ?? [],
        embedding: vector,
        engagementScore,
        freshnessScore,
        highlights,
        post,
      };
      contentVectors.set(post.id, snapshot);
      await prisma.contentVector.upsert({
        where: { postId: post.id },
        create: {
          postId: post.id,
          embedding: toJson(serializeVector(vector)),
          topicTags: toJson(snapshot.tags),
          engagementScore,
          freshnessScore,
          highlights: toJson(highlights),
        },
        update: {
          embedding: toJson(serializeVector(vector)),
          topicTags: toJson(snapshot.tags),
          engagementScore,
          freshnessScore,
          highlights: toJson(highlights),
        },
      });
      contentVectorUpdates += 1;
    } catch (error) {
      errorCount += 1;
      logger.error({ err: error, postId: post.id }, "Failed to refresh content vector");
    }
  }

  let profileUpdates = 0;
  let affinityUpdates = 0;

  for (const [userId, events] of eventsByUser.entries()) {
    if (!events.length) continue;
    try {
      const existing = profileByUser.get(userId);
      const effectiveEvents = existing?.analyticsOptOut ? [] : events;
      const topicPreferences = scoreTopicPreferences(effectiveEvents, tagsByPost);
      const engagedWeights = new Map<string, number>();
      for (const event of effectiveEvents) {
        if (!event.postId) continue;
        const durationWeight = clamp((event.durationSeconds ?? 0) / 240, 0.1, 2);
        const typeWeight = event.type === "session" ? 1.5 : event.type === "feedback" ? 1.2 : 1;
        const current = engagedWeights.get(event.postId) ?? 0;
        engagedWeights.set(event.postId, current + durationWeight * typeWeight);
      }
      const engagedContent = Array.from(engagedWeights.entries())
        .map(([postId, weight]) => {
          const content = contentVectors.get(postId);
          return content ? { content, weight } : null;
        })
        .filter((entry): entry is { content: ContentVectorSnapshot; weight: number } => Boolean(entry));
      const featureVector = buildFeatureVector(
        engagedContent.map((entry) => entry.content),
        engagedContent.map((entry) => entry.weight),
      );
      const toneTasks = usageByUser.get(userId) ?? [];
      const tonePreference = determineTonePreference(toneTasks);
      const snapshot = computeProfileSnapshot({
        userId,
        events: effectiveEvents,
        topicPreferences,
        tonePreference,
        featureVector,
        personalizationOptOut: existing?.personalizationOptOut ?? false,
        analyticsOptOut: existing?.analyticsOptOut ?? false,
      });
      const now = new Date();
      const persisted = await prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          topics: toJson({ tags: snapshot.topics.map((topic) => ({ ...topic, lastSeen: topic.lastSeen.toISOString() })) }),
          preferences: toJson({ tone: snapshot.tonePreference }),
          featureVector: toJson(snapshot.featureVector),
          avgReadTimeSeconds: snapshot.avgReadTimeSeconds,
          sessionCount: snapshot.sessionCount,
          viewCount: snapshot.viewCount,
          tonePreference: snapshot.tonePreference,
          segment: snapshot.segment,
          personalizationOptOut: snapshot.personalizationOptOut,
          analyticsOptOut: snapshot.analyticsOptOut,
          lastActiveAt: snapshot.lastActiveAt,
          lastInsightRefresh: now,
        },
        update: {
          topics: toJson({ tags: snapshot.topics.map((topic) => ({ ...topic, lastSeen: topic.lastSeen.toISOString() })) }),
          preferences: toJson({ tone: snapshot.tonePreference }),
          featureVector: toJson(snapshot.featureVector),
          avgReadTimeSeconds: snapshot.avgReadTimeSeconds,
          sessionCount: snapshot.sessionCount,
          viewCount: snapshot.viewCount,
          tonePreference: snapshot.tonePreference,
          segment: snapshot.segment,
          personalizationOptOut: snapshot.personalizationOptOut,
          analyticsOptOut: snapshot.analyticsOptOut,
          lastActiveAt: snapshot.lastActiveAt,
          lastInsightRefresh: now,
        },
      });
      profileUpdates += 1;

      if (options.refreshAffinities !== false && !snapshot.personalizationOptOut) {
        const scored: AffinityScore[] = [];
        for (const content of contentVectors.values()) {
          if (content.post.authorId === userId) {
            continue;
          }
          const { score, factors } = scoreAffinity(snapshot as UserProfileSnapshot, content);
          if (score <= 0.15) continue;
          scored.push({ postId: content.postId, affinity: score, reason: factors });
        }
        scored.sort((a, b) => b.affinity - a.affinity);
        const top = scored.slice(0, MAX_AFFINITIES);
        await prisma.$transaction([
          prisma.userContentAffinity.deleteMany({ where: { userProfileId: persisted.id } }),
          ...(top.length
            ? [
                prisma.userContentAffinity.createMany({
                  data: top.map((entry) => ({
                    userProfileId: persisted.id,
                    contentVectorId: entry.postId,
                    affinity: entry.affinity,
                    reason: toJson(entry.reason),
                  })),
                }),
              ]
            : []),
        ]);
        affinityUpdates += top.length;
      }
    } catch (error) {
      errorCount += 1;
      logger.error({ err: error, userId }, "Failed to refresh user profile");
    }
  }

  if (!options.skipAuditLog) {
    try {
      await recordAuditLog({
        userId: null,
        postId: null,
        task: "insight",
        prompt: `insights:refresh cutoff=${cutoff.toISOString()} profiles=${profileUpdates} vectors=${contentVectorUpdates}`,
        model: process.env.AI_MODEL_RECOMMENDER ?? process.env.AI_MODEL ?? "gpt-4o-mini",
        provider: process.env.AI_PROVIDER ?? "none",
        tokens: 0,
        moderated: false,
      });
    } catch (error) {
      logger.warn({ err: error }, "Failed to record insight audit log");
    }
  }

  const durationMs = Date.now() - startedAt;
  return {
    profiles: profileUpdates,
    contentVectors: contentVectorUpdates,
    affinities: affinityUpdates,
    durationMs,
    errors: errorCount,
  };
}

export type { RunInsightEtlOptions, RunInsightEtlResult };
