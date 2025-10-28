import { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";

const FEED_CACHE_PREFIX = "feed:v";

export type PrivacyPreferences = {
  personalizationOptOut: boolean;
  analyticsOptOut: boolean;
  segment?: string | null;
  lastInsightRefresh?: string | null;
};

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export async function getPrivacyPreferences(userId: string): Promise<PrivacyPreferences> {
  if (!isDatabaseEnabled) {
    return { personalizationOptOut: false, analyticsOptOut: false };
  }
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return { personalizationOptOut: false, analyticsOptOut: false };
  }
  return {
    personalizationOptOut: profile.personalizationOptOut,
    analyticsOptOut: profile.analyticsOptOut,
    segment: profile.segment,
    lastInsightRefresh: profile.lastInsightRefresh?.toISOString() ?? null,
  };
}

export async function updatePrivacyPreferences(
  userId: string,
  preferences: { personalizationOptOut?: boolean; analyticsOptOut?: boolean },
): Promise<PrivacyPreferences> {
  if (!isDatabaseEnabled) {
    return { personalizationOptOut: Boolean(preferences.personalizationOptOut), analyticsOptOut: Boolean(preferences.analyticsOptOut) };
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      topics: toJson({ tags: [] }),
      preferences: toJson({ tone: "informative" }),
      featureVector: toJson([]),
      personalizationOptOut: Boolean(preferences.personalizationOptOut),
      analyticsOptOut: Boolean(preferences.analyticsOptOut),
    },
    update: {
      personalizationOptOut:
        preferences.personalizationOptOut === undefined ? undefined : Boolean(preferences.personalizationOptOut),
      analyticsOptOut: preferences.analyticsOptOut === undefined ? undefined : Boolean(preferences.analyticsOptOut),
    },
  });

  if (preferences.personalizationOptOut) {
    try {
      await prisma.userContentAffinity.deleteMany({ where: { userProfileId: profile.id } });
    } catch (error) {
      logger.warn({ err: error, userId }, "Failed to clear affinities after opt-out");
    }
    const redisModule = await import("@/lib/redis");
    const redis = await redisModule.initRedis();
    if (redis) {
      try {
        const keys = await redis.keys(`${FEED_CACHE_PREFIX}*user:${userId}*`);
        if (keys.length) {
          await redis.del(keys);
        }
      } catch (error) {
        logger.warn({ err: error, userId }, "Failed to purge feed cache for opt-out");
      }
    }
  }

  return {
    personalizationOptOut: profile.personalizationOptOut,
    analyticsOptOut: profile.analyticsOptOut,
    segment: profile.segment,
    lastInsightRefresh: profile.lastInsightRefresh?.toISOString() ?? null,
  };
}

export async function exportUserInsights(userId: string) {
  if (!isDatabaseEnabled) {
    return null;
  }
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: {
      affinities: {
        orderBy: { affinity: "desc" },
        take: 25,
        include: { contentVector: { include: { post: true } } },
      },
    },
  });
  if (!profile) {
    return null;
  }
  return {
    userId,
    personalizationOptOut: profile.personalizationOptOut,
    analyticsOptOut: profile.analyticsOptOut,
    segment: profile.segment,
    avgReadTimeSeconds: profile.avgReadTimeSeconds,
    sessionCount: profile.sessionCount,
    viewCount: profile.viewCount,
    tonePreference: profile.tonePreference,
    topics: profile.topics,
    generatedAt: new Date().toISOString(),
    recommendations: profile.affinities.map((affinity) => ({
      postId: affinity.contentVectorId,
      affinity: affinity.affinity,
      title: affinity.contentVector?.post.title ?? "",
      slug: affinity.contentVector?.post.slug ?? "",
      reason: affinity.reason,
    })),
  };
}
