import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import type { CreatorInsightSnapshot } from "@/lib/personalization/types";
import { clamp } from "@/lib/utils";

function scoreCtr(engagement: number, freshness: number, wordCount: number) {
  const base = 0.05 + engagement * 0.3 + freshness * 0.2;
  const lengthPenalty = wordCount > 1800 ? 0.02 : 0;
  return clamp(base - lengthPenalty, 0.02, 0.4);
}

function scoreDwell(engagement: number, wordCount: number) {
  const minutes = Math.max(1, wordCount / 220);
  const base = minutes * 60;
  return Math.round(clamp(base * (0.8 + engagement), 120, 900));
}

function scoreEngagementProbability(engagement: number, freshness: number) {
  return clamp(0.3 + engagement * 0.5 + freshness * 0.3, 0.1, 0.98);
}

function detectDrivers(tags: string[], engagement: number, freshness: number) {
  const drivers: string[] = [];
  if (engagement > 0.6) {
    drivers.push("High recent engagement");
  }
  if (freshness > 0.6) {
    drivers.push("Recently updated");
  }
  if (tags.includes("ai")) {
    drivers.push("AI topic demand");
  }
  if (!drivers.length) {
    drivers.push("Stable evergreen interest");
  }
  return drivers;
}

export async function getCreatorInsightSnapshot(limit = 25): Promise<CreatorInsightSnapshot> {
  if (!isDatabaseEnabled) {
    return { posts: [], refreshedAt: new Date().toISOString(), model: "offline" };
  }

  const vectors = await prisma.contentVector.findMany({
    include: { post: { include: { tags: { include: { tag: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const posts = vectors.map((vector) => {
    const tags = vector.post.tags.map(({ tag }) => tag.name.toLowerCase());
    const wordCount = vector.post.contentMdx.split(/\s+/).length;
    const predictedCtr = Number(scoreCtr(vector.engagementScore, vector.freshnessScore, wordCount).toFixed(3));
    const predictedDwellSeconds = scoreDwell(vector.engagementScore, wordCount);
    const predictedEngagementProbability = Number(
      scoreEngagementProbability(vector.engagementScore, vector.freshnessScore).toFixed(3),
    );
    const topDrivers = detectDrivers(tags, vector.engagementScore, vector.freshnessScore);
    return {
      postId: vector.postId,
      slug: vector.post.slug,
      title: vector.post.title,
      predictedCtr,
      predictedDwellSeconds,
      predictedEngagementProbability,
      topDrivers,
      updatedAt: vector.updatedAt.toISOString(),
    };
  });

  return {
    posts,
    refreshedAt: new Date().toISOString(),
    model: process.env.AI_MODEL_RECOMMENDER ?? process.env.AI_MODEL ?? "gpt-4o-mini",
  } satisfies CreatorInsightSnapshot;
}
