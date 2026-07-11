import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const recordAuditLogMock = vi.fn();
const createPostRevisionSnapshotMock = vi.fn();
const triggerOutboundMock = vi.fn();
const notifySearchEnginesMock = vi.fn();

const prismaMock = {
  post: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, isDatabaseEnabled: true }));
vi.mock("@/lib/audit", () => ({ recordAuditLog: recordAuditLogMock }));
vi.mock("@/lib/cms/revisions", () => ({ createPostRevisionSnapshot: createPostRevisionSnapshotMock }));
vi.mock("@/lib/webhooks", () => ({ triggerOutbound: triggerOutboundMock }));
vi.mock("@/lib/seo", () => ({ notifySearchEngines: notifySearchEnginesMock, siteConfig: { url: "https://devlogia.test" } }));

const editorUser = { id: "editor_1", role: "editor", isActive: true };
const writerUser = { id: "writer_1", role: "writer", isActive: true };

function makePatchRequest(body: object) {
  return new NextRequest("http://localhost/api/admin/posts/post_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: object = {}) {
  return {
    title: "Updated title",
    slug: "updated-title",
    summary: "Updated summary",
    contentMdx: "Updated content",
    coverUrl: null,
    status: "DRAFT",
    publishedAt: null,
    tags: [],
    revisionReason: "manual",
    expectedUpdatedAt: "2026-07-11T10:00:00.000Z",
    ...overrides,
  };
}

describe("post admin route hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.post.findFirst.mockResolvedValue(null);
    prismaMock.post.update.mockImplementation(async ({ data }) => ({
      id: "post_1",
      authorId: "writer_1",
      updatedAt: new Date("2026-07-11T10:02:00.000Z"),
      ...data,
      tags: [],
    }));
  });

  it("rejects a stale autosave instead of overwriting another tab's edit", async () => {
    const { PATCH } = await import("@/app/api/admin/posts/[id]/route");
    authMock.mockResolvedValue({ user: editorUser });
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post_1",
      authorId: "writer_1",
      status: "DRAFT",
      publishedAt: null,
      slug: "server-title",
      updatedAt: new Date("2026-07-11T10:01:00.000Z"),
    });

    // Given/When: the client sends the row timestamp it originally loaded.
    const response = await PATCH(makePatchRequest(validPayload()), { params: Promise.resolve({ id: "post_1" }) });

    // Then: the server returns a conflict with the current row and does not write.
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/changed/i);
    expect(body.post.updatedAt).toBe("2026-07-11T10:01:00.000Z");
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it("returns forbidden when a writer attempts to publish instead of silently downgrading to draft", async () => {
    const { PATCH } = await import("@/app/api/admin/posts/[id]/route");
    authMock.mockResolvedValue({ user: writerUser });
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post_1",
      authorId: "writer_1",
      status: "DRAFT",
      publishedAt: null,
      slug: "writer-post",
      updatedAt: new Date("2026-07-11T10:00:00.000Z"),
    });

    // Given/When: a writer tampers with the payload to publish their draft.
    const response = await PATCH(
      makePatchRequest(validPayload({ status: "PUBLISHED", publishedAt: "2026-07-11T10:10:00.000Z" })),
      { params: Promise.resolve({ id: "post_1" }) },
    );

    // Then: the server clearly rejects the publish attempt.
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Writers can only save drafts" });
    expect(prismaMock.post.update).not.toHaveBeenCalled();
  });

  it("mints an expiring draft preview link for an authorized editor", async () => {
    const { POST } = await import("@/app/api/admin/posts/[id]/preview-token/route");
    authMock.mockResolvedValue({ user: editorUser });
    prismaMock.post.findUnique.mockResolvedValue({
      id: "post_1",
      authorId: "writer_1",
      slug: "draft-preview",
      status: "DRAFT",
      updatedAt: new Date("2026-07-11T10:00:00.000Z"),
    });
    process.env.NEXTAUTH_SECRET = "preview-secret";

    // Given/When: an editor asks for a preview URL for a draft.
    const response = await POST(new NextRequest("http://localhost/api/admin/posts/post_1/preview-token", { method: "POST" }), {
      params: Promise.resolve({ id: "post_1" }),
    });

    // Then: the route returns only a tokenized preview path, not a public draft URL.
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.previewUrl).toMatch(/^\/preview\/posts\/post_1\?token=/);
    expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
