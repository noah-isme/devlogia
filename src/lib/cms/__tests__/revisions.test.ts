import { describe, expect, test, vi } from "vitest";

import { createPostRevisionSnapshot, restorePostRevision } from "@/lib/cms/revisions";

describe("post revisions", () => {
  test("captures post content snapshot before a save", async () => {
    const create = vi.fn(async () => ({ id: "rev_1" }));
    const post = {
      id: "post_1",
      title: "Title",
      slug: "title",
      summary: "Summary",
      contentMdx: "# Body",
      coverUrl: null,
      status: "DRAFT" as const,
      publishedAt: null,
    };

    await createPostRevisionSnapshot({
      prisma: { postRevision: { create } },
      post,
      userId: "user_1",
      reason: "autosave",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        postId: "post_1",
        userId: "user_1",
        reason: "autosave",
        title: "Title",
        slug: "title",
        summary: "Summary",
        contentMdx: "# Body",
        coverUrl: null,
        status: "DRAFT",
        publishedAt: null,
      },
    });
  });

  test("restores a previous post revision", async () => {
    const revision = {
      id: "rev_1",
      postId: "post_1",
      title: "Old title",
      slug: "old-title",
      summary: null,
      contentMdx: "# Old",
      coverUrl: null,
      status: "DRAFT" as const,
      publishedAt: null,
    };
    const findUnique = vi.fn(async () => revision);
    const update = vi.fn(async () => ({ id: "post_1", title: "Old title" }));
    const auditLogCreate = vi.fn(async () => ({ id: "audit_1" }));

    await restorePostRevision({
      prisma: {
        postRevision: { findUnique },
        post: { update },
        auditLog: { create: auditLogCreate },
      },
      postId: "post_1",
      revisionId: "rev_1",
      userId: "user_1",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: {
        title: "Old title",
        slug: "old-title",
        summary: null,
        contentMdx: "# Old",
        coverUrl: null,
        status: "DRAFT",
        publishedAt: null,
      },
    });
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        action: "post:restore_revision",
        targetId: "post_1",
        meta: { revisionId: "rev_1" },
      },
    });
  });
});
