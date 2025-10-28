import type { Post, PostStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisStore = new Map<string, string>();

const redisMock = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (...args: [key: string, value: string, mode: string, ttl: number]) => {
    const [key, value] = args;
    redisStore.set(key, value);
    return "OK";
  }),
};

const dbState = { enabled: true };

const prismaMock = {
  post: {
    findMany: vi.fn(),
  },
  recommendation: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  embedding: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  recommendationSnapshot: {
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

vi.mock("@/lib/redis", () => ({
  initRedis: vi.fn(async () => redisMock),
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: prismaMock,
}));

const generateEmbeddingMock = vi.fn(async (text: string) => ({
  vector: [text.length || 1, 1],
  model: "test",
  provider: "local" as const,
}));

const deserializeVectorMock = vi.fn((value: unknown) => {
  return Array.isArray(value) ? (value as number[]) : [];
});

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
  generateEmbedding: generateEmbeddingMock,
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

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.resetModules();
    redisStore.clear();
    redisMock.get.mockClear();
    redisMock.set.mockClear();
    dbState.enabled = true;
    prismaMock.post.findMany.mockReset();
    prismaMock.recommendation.findMany.mockReset();
    prismaMock.recommendation.deleteMany.mockReset();
    prismaMock.recommendation.create.mockReset();
    prismaMock.embedding.findUnique.mockReset();
    prismaMock.embedding.upsert.mockReset();
    prismaMock.recommendationSnapshot.create.mockReset();
    generateEmbeddingMock.mockClear();
    deserializeVectorMock.mockClear();
  });

  it("returns cached recommendations when available", async () => {
    const cacheKey = "recommend:v2:limit:3";
    redisStore.set(
      cacheKey,
      JSON.stringify({
        items: [
          {
            id: "cached",
            slug: "cached",
            title: "Cached",
            summary: null,
            score: 0.9,
            publishedAt: null,
            tags: [],
          },
        ],
        generatedAt: "2024-01-01T00:00:00.000Z",
        latencyMs: 5,
        cache: "miss",
        fallback: false,
      }),
    );

    const { getRecommendations } = await import("@/lib/recommendations");

    const response = await getRecommendations({ limit: 3 });

    expect(response.cache).toBe("hit");
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.id).toBe("cached");
    expect(redisMock.get).toHaveBeenCalledWith(cacheKey);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("falls back to latest posts when no embeddings exist", async () => {
    prismaMock.recommendation.findMany.mockResolvedValueOnce([]);
    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        ...createPost("2", { slug: "latest", publishedAt: new Date("2024-01-03T00:00:00.000Z") }),
        tags: [{ tag: { name: "Next.js" } }],
      },
      {
        ...createPost("1", { slug: "first", publishedAt: new Date("2024-01-01T00:00:00.000Z") }),
        tags: [{ tag: { name: "React" } }],
      },
    ]);

    const { getRecommendations } = await import("@/lib/recommendations");

    const response = await getRecommendations({ limit: 2 });

    expect(response.fallback).toBe(true);
    expect(response.items).toHaveLength(2);
    expect(response.items[0]?.slug).toBe("latest");
    expect(redisMock.set).toHaveBeenCalledTimes(1);
    const [, , mode, ttl] = redisMock.set.mock.calls[0]!;
    expect(mode).toBe("EX");
    expect(ttl).toBe(Number(process.env.RECOMMENDER_CACHE_TTL ?? 3600));
  });

  it("computes recommendations from query and preferences", async () => {
    prismaMock.recommendation.findMany.mockResolvedValueOnce([]);
    prismaMock.embedding.findUnique.mockResolvedValueOnce(null);
    prismaMock.post.findMany.mockResolvedValueOnce([
      {
        ...createPost("1", { slug: "testing-post", title: "Testing Tips" }),
        embedding: { vector: [1, 0] },
        tags: [{ tag: { name: "Testing" } }],
      },
      {
        ...createPost("2", { slug: "react-post", title: "React Patterns" }),
        embedding: { vector: [0.7, 0.7] },
        tags: [{ tag: { name: "React" } }],
      },
    ]);

    generateEmbeddingMock.mockResolvedValueOnce({ vector: [1, 0], model: "test", provider: "local" });

    const { getRecommendations } = await import("@/lib/recommendations");

    const response = await getRecommendations({ query: "Testing best practices", userPreferences: ["Testing"] });

    expect(response.fallback).toBe(false);
    expect(response.items).toHaveLength(2);
    expect(response.items[0]?.slug).toBe("testing-post");
    expect(response.items[0]?.score).toBeGreaterThan(response.items[1]!.score);
    expect(redisMock.set).toHaveBeenCalledTimes(1);
  });
});
