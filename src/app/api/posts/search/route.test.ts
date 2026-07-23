import { beforeEach, describe, expect, test, vi } from "vitest";

const findManyPostsMock = vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []);

const dbState = { enabled: true };

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    post: {
      findMany: findManyPostsMock,
    },
  },
}));

describe("/api/posts/search", () => {
  beforeEach(() => {
    dbState.enabled = true;
    findManyPostsMock.mockReset();
    findManyPostsMock.mockResolvedValue([]);
  });

  test("GET returns empty array if q parameter is blank", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/posts/search?q=");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  test("GET executes vector search and returns scored results", async () => {
    findManyPostsMock.mockResolvedValueOnce([
      {
        id: "p1",
        slug: "nextjs-guide",
        title: "Next.js Guide",
        summary: "A complete guide to Next.js",
        coverUrl: null,
        publishedAt: new Date(),
        tags: [{ tag: { name: "Next.js", slug: "nextjs" } }],
        embedding: { dimension: 1536 },
        contentVector: { topicTags: ["nextjs"] },
      },
    ]);

    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/posts/search?q=Next.js");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Next.js Guide");
    expect(body.results[0].matchType).toContain("Vector Match");
  });
});
