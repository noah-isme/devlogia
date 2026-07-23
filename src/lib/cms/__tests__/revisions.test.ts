import { describe, expect, test, vi } from "vitest";

import {
  createPageRevisionSnapshot,
  createPostRevisionSnapshot,
  restorePageRevision,
  restorePostRevision,
} from "@/lib/cms/revisions";

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
        seoTitle: null,
        seoDescription: null,
        canonicalUrl: null,
        ogImageUrl: null,
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
    const postRevisionCreate = vi.fn(async () => ({ id: "rev_restore" }));
    const auditLogCreate = vi.fn(async () => ({ id: "audit_1" }));

    await restorePostRevision({
      prisma: {
        postRevision: { findUnique, create: postRevisionCreate },
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
    expect(postRevisionCreate).toHaveBeenCalledWith({
      data: {
        postId: "post_1",
        userId: "user_1",
        reason: "restore",
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

describe("page revisions", () => {
  test("captures page content snapshot", async () => {
    const create = vi.fn(async () => ({ id: "page_rev_1" }));
    const page = {
      id: "page_1",
      title: "About Us",
      slug: "about",
      contentMdx: "# About Us",
      published: true,
    };

    await createPageRevisionSnapshot({
      prisma: { pageRevision: { create } },
      page,
      userId: "user_1",
      reason: "manual",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        pageId: "page_1",
        userId: "user_1",
        reason: "manual",
        title: "About Us",
        slug: "about",
        contentMdx: "# About Us",
        published: true,
      },
    });
  });

  test("restores a previous page revision and records a restore snapshot", async () => {
    const revision = {
      id: "page_rev_1",
      pageId: "page_1",
      title: "About Us (v1)",
      slug: "about-v1",
      contentMdx: "# About Us v1",
      published: false,
    };
    const findUnique = vi.fn(async () => revision);
    const update = vi.fn(async () => ({ id: "page_1", title: "About Us (v1)" }));
    const pageRevisionCreate = vi.fn(async () => ({ id: "page_rev_restore" }));
    const auditLogCreate = vi.fn(async () => ({ id: "audit_2" }));

    await restorePageRevision({
      prisma: {
        pageRevision: { findUnique, create: pageRevisionCreate },
        page: { update },
        auditLog: { create: auditLogCreate },
      },
      pageId: "page_1",
      revisionId: "page_rev_1",
      userId: "user_1",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "page_1" },
      data: {
        title: "About Us (v1)",
        slug: "about-v1",
        contentMdx: "# About Us v1",
        published: false,
      },
    });
    expect(pageRevisionCreate).toHaveBeenCalledWith({
      data: {
        pageId: "page_1",
        userId: "user_1",
        reason: "restore",
        title: "About Us (v1)",
        slug: "about-v1",
        contentMdx: "# About Us v1",
        published: false,
      },
    });
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        action: "page:restore_revision",
        targetId: "page_1",
        meta: { revisionId: "page_rev_1" },
      },
    });
  });
});

