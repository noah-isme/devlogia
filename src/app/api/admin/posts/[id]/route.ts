import { NextRequest, NextResponse } from "next/server";

import type { PostStatus, PrismaClient } from "@prisma/client";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { notifySearchEngines, siteConfig } from "@/lib/seo";
import { triggerOutbound } from "@/lib/webhooks";
import { upsertPostSchema } from "@/lib/validations/post";
import { createPostRevisionSnapshot } from "@/lib/cms/revisions";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function writerPublishForbiddenResponse() {
  return NextResponse.json({ error: "Writers can only save drafts" }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflictResponse(post: { updatedAt: Date }) {
  return NextResponse.json(
    { error: "Post changed in another tab", post: { ...post, updatedAt: post.updatedAt.toISOString() } },
    { status: 409 },
  );
}

function normalizeTags(tags: string[] | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

async function ensureUniqueSlug(prismaClient: PrismaClient, baseSlug: string, excludeId: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const existing = await prismaClient.post.findFirst({
      where: {
        slug: candidate,
        NOT: { id: excludeId },
      },
    });

    if (!existing) {
      return candidate;
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();
  if (!session?.user) {
    return unauthorizedResponse();
  }

  const post = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });

  if (!post) {
    return notFoundResponse();
  }

  if (!can(session.user, "post:update", post)) {
    return forbiddenResponse();
  }

  return NextResponse.json({ post });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) {
    return notFoundResponse();
  }

  if (!can(session.user, "post:update", post)) {
    return forbiddenResponse();
  }

  const json = await request.json().catch(() => ({}));
  const parsed = upsertPostSchema.parse(json);
  const isWriter = session.user.role === "writer";
  if (isWriter && parsed.status !== "DRAFT") {
    return writerPublishForbiddenResponse();
  }

  if (parsed.expectedUpdatedAt && new Date(parsed.expectedUpdatedAt).getTime() < post.updatedAt.getTime()) {
    return conflictResponse(post);
  }

  let data: typeof parsed = parsed;
  if (isWriter) {
    data = { ...data, status: "DRAFT", publishedAt: null };
  }

  const normalizedTags = normalizeTags(data.tags);
  const baseSlug = slugify(data.slug);
  const slug = await ensureUniqueSlug(prisma, baseSlug, id);

  const publishedAt = (() => {
    const requestedPublishedAt = data.publishedAt ? new Date(data.publishedAt) : null;

    if (data.status === "SCHEDULED") {
      if (!requestedPublishedAt) {
        return null;
      }
      return requestedPublishedAt;
    }

    if (data.status === "PUBLISHED") {
      if (requestedPublishedAt) {
        return requestedPublishedAt;
      }
      return post.publishedAt ?? new Date();
    }

    if (isWriter) {
      return null;
    }

    return requestedPublishedAt;
  })();

  if (!isWriter && data.status === "SCHEDULED") {
    if (!publishedAt) {
      return badRequestResponse("Scheduled posts require a future publish time");
    }
    if (publishedAt.getTime() <= Date.now()) {
      return badRequestResponse("Scheduled publish time must be in the future");
    }
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      contentMdx: data.contentMdx,
      coverUrl: data.coverUrl ?? null,
      status: data.status as PostStatus,
      publishedAt,
      tags: {
        deleteMany: {},
        create: normalizedTags.map((tagName) => {
          const tagSlug = slugify(tagName);
          return {
            tag: {
              connectOrCreate: {
                where: { slug: tagSlug },
                create: { name: tagName, slug: tagSlug },
              },
            },
          };
        }),
      },
    },
    include: { tags: { include: { tag: true } } },
  });

  await createPostRevisionSnapshot({
    prisma,
    post,
    userId: session.user.id,
    reason: post.status !== "PUBLISHED" && updated.status === "PUBLISHED" ? "publish" : data.revisionReason ?? "autosave",
  });

  await recordAuditLog({
    userId: session.user.id,
    action: "post:update",
    targetId: updated.id,
    meta: {
      status: updated.status,
    },
  });

  if (post.status !== "SCHEDULED" && updated.status === "SCHEDULED") {
    await recordAuditLog({
      userId: session.user.id,
      action: "post:scheduled",
      targetId: updated.id,
      meta: { slug: updated.slug, publishedAt: updated.publishedAt?.toISOString() ?? null },
    });
  }

  if (post.status !== "PUBLISHED" && updated.status === "PUBLISHED") {
    await recordAuditLog({
      userId: session.user.id,
      action: "post:publish",
      targetId: updated.id,
      meta: { slug: updated.slug },
    });
    const publicUrl = `${siteConfig.url}/blog/${updated.slug}`;
    await triggerOutbound("post.published", {
      id: updated.id,
      slug: updated.slug,
      status: updated.status,
      url: publicUrl,
    });
    void notifySearchEngines();
  }

  if (post.status === "PUBLISHED" && updated.status !== "PUBLISHED") {
    await recordAuditLog({
      userId: session.user.id,
      action: "post:unpublish",
      targetId: updated.id,
      meta: { slug: updated.slug, status: updated.status },
    });
    await triggerOutbound("post.unpublished", {
      id: updated.id,
      slug: updated.slug,
      status: updated.status,
    });
    void notifySearchEngines();
  }

  return NextResponse.json({ post: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) {
    return notFoundResponse();
  }

  if (!can(session.user, "post:delete", post)) {
    return forbiddenResponse();
  }

  await prisma.$transaction([
    prisma.recommendation.deleteMany({
      where: { OR: [{ sourcePostId: id }, { targetPostId: id }] },
    }),
    prisma.recommendationSnapshot.deleteMany({
      where: { embedding: { is: { postId: id } } },
    }),
    prisma.embedding.deleteMany({ where: { postId: id } }),
    prisma.postTopic.deleteMany({ where: { postId: id } }),
    prisma.headlineVariant.deleteMany({ where: { postId: id } }),
    prisma.aIUsage.updateMany({ where: { postId: id }, data: { postId: null } }),
    prisma.aIAuditLog.updateMany({ where: { postId: id }, data: { postId: null } }),
    prisma.userContentAffinity.deleteMany({
      where: { contentVector: { is: { postId: id } } },
    }),
    prisma.contentVector.deleteMany({ where: { postId: id } }),
    prisma.postTag.deleteMany({ where: { postId: id } }),
    prisma.postRevision.deleteMany({ where: { postId: id } }),
    prisma.post.delete({ where: { id } }),
  ]);

  await recordAuditLog({
    userId: session.user.id,
    action: "post:delete",
    targetId: id,
    meta: { slug: post.slug },
  });

  return NextResponse.json({ success: true });
}
