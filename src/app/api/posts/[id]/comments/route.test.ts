import { beforeEach, describe, expect, test, vi } from "vitest";

type CommentRecord = {
  id: string;
  postId: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
};

const findManyMock = vi.fn<() => Promise<CommentRecord[]>>(async () => []);
const findUniquePostMock = vi.fn(async () => ({ id: "post_1" }));
const createCommentMock = vi.fn<() => Promise<CommentRecord>>(async () => ({
  id: "comment_1",
  postId: "post_1",
  parentId: null,
  authorName: "Alice",
  content: "Great article!",
  createdAt: new Date().toISOString(),
}));

const dbState = { enabled: true };

vi.mock("@/lib/prisma", () => ({
  get isDatabaseEnabled() {
    return dbState.enabled;
  },
  prisma: {
    comment: {
      findMany: findManyMock,
      create: createCommentMock,
      findUnique: vi.fn(),
    },
    post: {
      findUnique: findUniquePostMock,
    },
  },
}));

describe("/api/posts/[id]/comments", () => {
  beforeEach(() => {
    dbState.enabled = true;
    findManyMock.mockReset();
    findUniquePostMock.mockReset();
    createCommentMock.mockReset();
    findUniquePostMock.mockResolvedValue({ id: "post_1" });
  });

  test("GET returns list of approved comments", async () => {
    findManyMock.mockResolvedValueOnce([
      { id: "c1", postId: "post_1", parentId: null, authorName: "Alice", content: "Nice!", createdAt: new Date().toISOString() },
    ]);

    const { GET } = await import("./route");
    const req = new Request("http://localhost:3000/api/posts/post_1/comments");
    const res = await GET(req, { params: Promise.resolve({ id: "post_1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].authorName).toBe("Alice");
  });

  test("POST validates authorName, authorEmail, and content", async () => {
    const { POST } = await import("./route");

    // Missing authorName
    const reqInvalid = new Request("http://localhost:3000/api/posts/post_1/comments", {
      method: "POST",
      body: JSON.stringify({ authorName: "", authorEmail: "user@test.com", content: "Hello" }),
    });
    const resInvalid = await POST(reqInvalid, { params: Promise.resolve({ id: "post_1" }) });
    expect(resInvalid.status).toBe(400);

    // Valid submission
    createCommentMock.mockResolvedValueOnce({
      id: "c2",
      postId: "post_1",
      parentId: null,
      authorName: "Bob",
      content: "Awesome post!",
      createdAt: new Date().toISOString(),
    });
    const reqValid = new Request("http://localhost:3000/api/posts/post_1/comments", {
      method: "POST",
      body: JSON.stringify({ authorName: "Bob", authorEmail: "bob@test.com", content: "Awesome post!" }),
    });
    const resValid = await POST(reqValid, { params: Promise.resolve({ id: "post_1" }) });
    expect(resValid.status).toBe(201);
    const body = await resValid.json();
    expect(body.comment.authorName).toBe("Bob");
  });
});
