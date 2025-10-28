import type { Post } from "@prisma/client";

import { averageVectors, cosineSimilarity, deserializeVector } from "@/lib/ai/embeddings";
import { logger } from "@/lib/logger";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type EmbeddedPost = {
  post: Post & { tags: Array<{ tag: { name: string } }> };
  vector: number[];
};

type Cluster = {
  centroid: number[];
  members: EmbeddedPost[];
};

function chooseInitialCentroids(data: EmbeddedPost[], k: number) {
  const centroids: number[][] = [];
  const used = new Set<number>();
  while (centroids.length < k) {
    const index = Math.floor(Math.random() * data.length);
    if (used.has(index)) continue;
    used.add(index);
    centroids.push([...data[index]!.vector]);
  }
  return centroids;
}

function assignToClusters(data: EmbeddedPost[], centroids: number[][]): Cluster[] {
  const clusters: Cluster[] = centroids.map((centroid) => ({ centroid, members: [] }));
  for (const item of data) {
    if (!item.vector.length) continue;
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < centroids.length; index += 1) {
      const centroid = centroids[index]!;
      const score = cosineSimilarity(item.vector, centroid);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    clusters[bestIndex]!.members.push(item);
  }
  return clusters;
}

function recomputeCentroids(clusters: Cluster[]) {
  return clusters.map((cluster) => {
    if (!cluster.members.length) {
      return cluster.centroid;
    }
    const vectors = cluster.members.map((member) => member.vector);
    return averageVectors(vectors);
  });
}

function ensureValidClusters(clusters: Cluster[], fallback: EmbeddedPost[]) {
  const valid = clusters.filter((cluster) => cluster.members.length);
  if (valid.length) {
    return valid;
  }
  if (!fallback.length) {
    return [];
  }
  return [{ centroid: fallback[0]!.vector, members: fallback.slice(0, 1) }];
}

function keywordSummary(posts: EmbeddedPost[]) {
  const counter = new Map<string, number>();
  for (const { post } of posts) {
    for (const entry of post.tags) {
      const tag = entry.tag.name.toLowerCase();
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
    const words = `${post.title} ${post.summary ?? ""}`.toLowerCase().split(/[^a-z0-9]+/g);
    for (const word of words) {
      if (!word || word.length < 4) continue;
      counter.set(word, (counter.get(word) ?? 0) + 0.5);
    }
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword]) => keyword);
}

export async function regenerateTopicClusters() {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    logger.warn("Database disabled. Skipping topic clustering.");
    return { clusters: 0, posts: 0 };
  }

  const records = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    include: {
      embedding: true,
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const embedded: EmbeddedPost[] = records
    .map((post) => ({
      post,
      vector: deserializeVector(post.embedding?.vector ?? []),
    }))
    .filter((entry) => entry.vector.length);

  if (!embedded.length) {
    await prisma.topicCluster.deleteMany();
    await prisma.postTopic.deleteMany();
    return { clusters: 0, posts: 0 };
  }

  const k = clamp(Math.round(Math.sqrt(embedded.length)), 2, Math.min(embedded.length, 8));
  let centroids = chooseInitialCentroids(embedded, k);

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const clusters = assignToClusters(embedded, centroids);
    const nextCentroids = recomputeCentroids(clusters);
    const maxShift = centroids.reduce((acc, centroid, index) => {
      const next = nextCentroids[index]!;
      if (!centroid.length || !next.length) return acc;
      const shift = 1 - cosineSimilarity(centroid, next);
      return Math.max(acc, shift);
    }, 0);
    centroids = nextCentroids;
    if (maxShift < 0.01) {
      break;
    }
  }

  const clustered = assignToClusters(embedded, centroids);
  const validClusters = ensureValidClusters(clustered, embedded);

  await prisma.postTopic.deleteMany();
  await prisma.topicCluster.deleteMany();

  let totalAssignments = 0;

  for (const cluster of validClusters) {
    const keywords = keywordSummary(cluster.members);
    const label = keywords[0] ? keywords[0].replace(/\b\w/g, (char) => char.toUpperCase()) : "Topic";
    const created = await prisma.topicCluster.create({
      data: {
        label,
        keywords,
      },
    });

    for (const member of cluster.members) {
      const score = cosineSimilarity(cluster.centroid, member.vector);
      await prisma.postTopic.create({
        data: {
          topicId: created.id,
          postId: member.post.id,
          score: Number.isFinite(score) ? score : 0,
        },
      });
      totalAssignments += 1;
    }
  }

  return { clusters: validClusters.length, posts: totalAssignments };
}
