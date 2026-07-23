import { beforeEach, describe, expect, test, vi } from "vitest";

const authMock = vi.fn(async () => ({ user: { id: "u1", role: "admin" } }));
const findManyCommentsMock = vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []);
const updateCommentMock = vi.fn(async () => ({ id: "c1", status: "APPROVED" }));
const deleteCommentMock = vi.fn(async () => ({ id: "c1" }));

const dbState = { enabled: true };

vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    comment: {
      findMany: findManyCommentsMock,
      update: updateCommentMock,
      delete: deleteCommentMock,
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("/api/admin/comments", () => {
  beforeEach(() => {
    dbState.enabled = true;
    authMock.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    findManyCommentsMock.mockReset();
    updateCommentMock.mockReset();
    deleteCommentMock.mockReset();
    findManyCommentsMock.mockResolvedValue([]);
  });

  test("GET lists comments for authenticated admin", async () => {
    findManyCommentsMock.mockResolvedValueOnce([
      {
        id: "c1",
        postId: "p1",
        authorName: "Alice",
        authorEmail: "alice@test.com",
        content: "Nice post",
        status: "PENDING",
        createdAt: new Date(),
        post: { title: "Test Post", slug: "test-post" },
      },
    ]);

    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/admin/comments");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].post.title).toBe("Test Post");
  });

  test("PATCH updates comment status", async () => {
    const { PATCH } = await import("./[id]/route");
    const req = new Request("http://localhost:3000/api/admin/comments/c1", {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(200);
    expect(updateCommentMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "APPROVED" },
    });
  });

  test("DELETE removes comment", async () => {
    const { DELETE } = await import("./[id]/route");
    const req = new Request("http://localhost:3000/api/admin/comments/c1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "c1" }) });

    expect(res.status).toBe(200);
    expect(deleteCommentMock).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
