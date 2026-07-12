import { Prisma } from "@prisma/client";
import type { PostStatus } from "@prisma/client";

type RevisionReason = "autosave" | "manual" | "publish" | "restore";

type PostSnapshot = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly summary: string | null;
  readonly contentMdx: string;
  readonly coverUrl: string | null;
  readonly status: PostStatus;
  readonly publishedAt: Date | null;
};

type PageSnapshot = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly contentMdx: string;
  readonly published: boolean;
};

type PostRevisionCreateClient = {
  readonly postRevision: {
    create(input: { data: Prisma.PostRevisionUncheckedCreateInput }): Promise<unknown>;
  };
};

type PageRevisionCreateClient = {
  readonly pageRevision: {
    create(input: { data: Prisma.PageRevisionUncheckedCreateInput }): Promise<unknown>;
  };
};

type PostRevisionRestoreClient = {
  readonly postRevision: {
    findUnique(input: { where: { id: string } }): Promise<{
      readonly id: string;
      readonly postId: string;
      readonly title: string;
      readonly slug: string;
      readonly summary: string | null;
      readonly contentMdx: string;
      readonly coverUrl: string | null;
      readonly status: PostStatus;
      readonly publishedAt: Date | null;
    } | null>;
  };
  readonly post: {
    update(input: { where: { id: string }; data: Prisma.PostUpdateInput }): Promise<unknown>;
  };
  readonly auditLog: {
    create(input: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

type PageRevisionRestoreClient = {
  readonly pageRevision: {
    findUnique(input: { where: { id: string } }): Promise<{
      readonly id: string;
      readonly pageId: string;
      readonly title: string;
      readonly slug: string;
      readonly contentMdx: string;
      readonly published: boolean;
    } | null>;
  };
  readonly page: {
    update(input: { where: { id: string }; data: Prisma.PageUpdateInput }): Promise<unknown>;
  };
  readonly auditLog: {
    create(input: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

export async function createPostRevisionSnapshot(input: {
  readonly prisma: PostRevisionCreateClient;
  readonly post: PostSnapshot;
  readonly userId: string | null;
  readonly reason: RevisionReason;
}) {
  await input.prisma.postRevision.create({
    data: {
      postId: input.post.id,
      userId: input.userId,
      reason: input.reason,
      title: input.post.title,
      slug: input.post.slug,
      summary: input.post.summary,
      contentMdx: input.post.contentMdx,
      coverUrl: input.post.coverUrl,
      status: input.post.status,
      publishedAt: input.post.publishedAt,
    },
  });
}

export async function createPageRevisionSnapshot(input: {
  readonly prisma: PageRevisionCreateClient;
  readonly page: PageSnapshot;
  readonly userId: string | null;
  readonly reason: RevisionReason;
}) {
  await input.prisma.pageRevision.create({
    data: {
      pageId: input.page.id,
      userId: input.userId,
      reason: input.reason,
      title: input.page.title,
      slug: input.page.slug,
      contentMdx: input.page.contentMdx,
      published: input.page.published,
    },
  });
}

export async function restorePostRevision(input: {
  readonly prisma: PostRevisionRestoreClient & PostRevisionCreateClient;
  readonly postId: string;
  readonly revisionId: string;
  readonly userId: string | null;
}) {
  const revision = await input.prisma.postRevision.findUnique({ where: { id: input.revisionId } });
  if (!revision || revision.postId !== input.postId) {
    return null;
  }

  await input.prisma.post.update({
    where: { id: input.postId },
    data: {
      title: revision.title,
      slug: revision.slug,
      summary: revision.summary,
      contentMdx: revision.contentMdx,
      coverUrl: revision.coverUrl,
      status: revision.status,
      publishedAt: revision.publishedAt,
    },
  });
  await input.prisma.postRevision.create({
    data: {
      postId: input.postId,
      userId: input.userId,
      reason: "restore",
      title: revision.title,
      slug: revision.slug,
      summary: revision.summary,
      contentMdx: revision.contentMdx,
      coverUrl: revision.coverUrl,
      status: revision.status,
      publishedAt: revision.publishedAt,
    },
  });
  await input.prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "post:restore_revision",
      targetId: input.postId,
      meta: { revisionId: input.revisionId },
    },
  });

  return revision;
}

export async function restorePageRevision(input: {
  readonly prisma: PageRevisionRestoreClient;
  readonly pageId: string;
  readonly revisionId: string;
  readonly userId: string | null;
}) {
  const revision = await input.prisma.pageRevision.findUnique({ where: { id: input.revisionId } });
  if (!revision || revision.pageId !== input.pageId) {
    return null;
  }

  await input.prisma.page.update({
    where: { id: input.pageId },
    data: {
      title: revision.title,
      slug: revision.slug,
      contentMdx: revision.contentMdx,
      published: revision.published,
    },
  });
  await input.prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "page:restore_revision",
      targetId: input.pageId,
      meta: { revisionId: input.revisionId },
    },
  });

  return revision;
}
