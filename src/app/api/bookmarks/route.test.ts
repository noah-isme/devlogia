import { beforeEach, describe, expect, test, vi } from "vitest";

const authMock = vi.fn(async () => ({ user: { id: "u1", role: "viewer" } }));
const findManyBookmarksMock = vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []);
const findUniqueBookmarkMock = vi.fn<() => Promise<Record<string, unknown> | null>>(async () => null);
const createBookmarkMock = vi.fn(async () => ({ id: "b1" }));
const deleteBookmarkMock = vi.fn(async () => ({ id: "b1" }));

const dbState = { enabled: true };

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    bookmark: {
      findMany: findManyBookmarksMock,
      findUnique: findUniqueBookmarkMock,
      create: createBookmarkMock,
      delete: deleteBookmarkMock,
    },
  },
}));

describe("/api/bookmarks", () => {
  beforeEach(() => {
    dbState.enabled = true;
    authMock.mockResolvedValue({ user: { id: "u1", role: "viewer" } });
    findManyBookmarksMock.mockReset();
    findUniqueBookmarkMock.mockReset();
    createBookmarkMock.mockReset();
    deleteBookmarkMock.mockReset();
    findManyBookmarksMock.mockResolvedValue([]);
    findUniqueBookmarkMock.mockResolvedValue(null);
  });

  test("GET returns saved bookmarks for user", async () => {
    findManyBookmarksMock.mockResolvedValueOnce([
      { id: "b1", postId: "p1", createdAt: new Date(), post: { title: "Post 1", slug: "post-1" } },
    ]);

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarks).toHaveLength(1);
  });

  test("POST creates a bookmark if not existing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost:3001/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({ postId: "p1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarked).toBe(true);
    expect(createBookmarkMock).toHaveBeenCalledOnce();
  });
});
