import type { Post, PostStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbState = { enabled: true };

const prismaMock = {
  post: {
    findMany: vi.fn(),
  },
  topicCluster: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  postTopic: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: prismaMock,
}));

const deserializeVectorMock = vi.fn((value: unknown) => (Array.isArray(value) ? (value as number[]) : []));

function averageVectors(vectors: number[][]) {
  if (!vectors.length) {
    return [] as number[];
  }
  const dimension = vectors[0]?.length ?? 0;
  if (!dimension) {
    return [] as number[];
  }
  const sums = new Array(dimension).fill(0);
  for (const vector of vectors) {
    if (vector.length !== dimension) continue;
    for (let index = 0; index < dimension; index += 1) {
      sums[index] += vector[index];
    }
  }
  const norm = Math.hypot(...sums);
  if (!Number.isFinite(norm) || norm === 0) {
    return sums.map(() => 0);
  }
  return sums.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index]!;
    const bv = b[index]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / Math.sqrt(normA * normB);
}

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(),
  deserializeVector: deserializeVectorMock,
  averageVectors,
  cosineSimilarity,
  serializeVector: (vector: number[]) => vector,
}));

function createPost(id: string, overrides: Partial<Post> = {}): Post {
  const now = new Date("2024-01-01T00:00:00.000Z");
  return {
    id,
    slug: `post-${id}`,
    title: `Post ${id}`,
    summary: `Summary ${id}`,
    contentMdx: "Content",
    coverUrl: null,
    status: "PUBLISHED" as PostStatus,
    publishedAt: now,
    authorId: "author",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Post;
}

describe("regenerateTopicClusters", () => {
  const mathRandom = vi.spyOn(Math, "random");

  beforeEach(() => {
    vi.resetModules();
    dbState.enabled = true;
    prismaMock.post.findMany.mockReset();
    prismaMock.topicCluster.deleteMany.mockReset();
    prismaMock.topicCluster.create.mockReset();
    prismaMock.postTopic.deleteMany.mockReset();
    prismaMock.postTopic.create.mockReset();
    deserializeVectorMock.mockReset();
    mathRandom.mockReset();
  });

  afterEach(() => {
    mathRandom.mockReset();
  });

  it("skips clustering when database disabled", async () => {
    dbState.enabled = false;

    const { regenerateTopicClusters } = await import("@/lib/topics");
    const result = await regenerateTopicClusters();

    expect(result).toEqual({ clusters: 0, posts: 0 });
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
  });

  it("creates clusters with keyword summaries", async () => {
    const posts = [
      {
        ...createPost("1", { title: "React Patterns", summary: "Hooks overview" }),
        embedding: { vector: [0.99, 0.1] },
        tags: [{ tag: { name: "React" } }],
      },
      {
        ...createPost("2", { title: "Advanced React", summary: "Components" }),
        embedding: { vector: [0.95, 0.2] },
        tags: [{ tag: { name: "React" } }],
      },
      {
        ...createPost("3", { title: "Testing with Vitest", summary: "Automation" }),
        embedding: { vector: [0.1, 0.98] },
        tags: [{ tag: { name: "Testing" } }],
      },
    ];

    prismaMock.post.findMany.mockResolvedValueOnce(posts);
    prismaMock.topicCluster.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.postTopic.deleteMany.mockResolvedValueOnce({ count: 0 });

    const createdClusters: Array<{ id: string; label: string; keywords: string[] }> = [];
    prismaMock.topicCluster.create.mockImplementation(async ({ data }: { data: { label: string; keywords: string[] } }) => {
      const cluster = { id: `cluster-${createdClusters.length + 1}`, label: data.label, keywords: data.keywords };
      createdClusters.push(cluster);
      return cluster;
    });

    const assignments: Array<{ topicId: string; postId: string; score: number }> = [];
    prismaMock.postTopic.create.mockImplementation(async ({ data }: { data: { topicId: string; postId: string; score: number } }) => {
      assignments.push(data);
      return data;
    });

    mathRandom.mockReturnValueOnce(0).mockReturnValueOnce(0.99).mockReturnValue(0.99);

    const { regenerateTopicClusters } = await import("@/lib/topics");
    const result = await regenerateTopicClusters();

    expect(result.clusters).toBe(2);
    expect(result.posts).toBe(3);
    expect(createdClusters).toHaveLength(2);
    expect(createdClusters[0]?.keywords[0]).toBe("react");
    expect(createdClusters[0]?.label).toBe("React");
    expect(createdClusters[1]?.keywords[0]).toBe("testing");
    expect(assignments).toHaveLength(3);
    const assignedTopics = new Set(assignments.map((entry) => entry.topicId));
    expect(assignedTopics.size).toBe(2);
  });
});
