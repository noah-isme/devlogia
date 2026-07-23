import { beforeEach, describe, expect, test, vi } from "vitest";

const findManyReactionsMock = vi.fn<() => Promise<Array<{ type: string; count: number }>>>(async () => []);
const upsertReactionMock = vi.fn(async () => ({ id: "pr_1" }));
const findUniquePostMock = vi.fn(async () => ({ id: "post_1" }));

const dbState = { enabled: true };

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    postReaction: {
      findMany: findManyReactionsMock,
      upsert: upsertReactionMock,
    },
    post: {
      findUnique: findUniquePostMock,
    },
  },
}));

describe("/api/posts/[id]/reactions", () => {
  beforeEach(() => {
    dbState.enabled = true;
    findManyReactionsMock.mockReset();
    upsertReactionMock.mockReset();
    findUniquePostMock.mockReset();
    findManyReactionsMock.mockResolvedValue([]);
    findUniquePostMock.mockResolvedValue({ id: "post_1" });
  });

  test("GET returns initial zero reaction map", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/posts/post_1/reactions");
    const res = await GET(req, { params: Promise.resolve({ id: "post_1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactions.clap).toBe(0);
    expect(body.reactions.fire).toBe(0);
  });

  test("POST increments reaction count", async () => {
    findManyReactionsMock.mockResolvedValueOnce([{ type: "clap", count: 5 }]);

    const { POST } = await import("./route");
    const req = new Request("http://localhost:3000/api/posts/post_1/reactions", {
      method: "POST",
      body: JSON.stringify({ type: "clap", amount: 1 }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "post_1" }) });

    expect(res.status).toBe(200);
    expect(upsertReactionMock).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.reactions.clap).toBe(5);
  });
});
