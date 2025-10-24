import { NextResponse } from "next/server";

import type { PostStatus, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { triggerOutbound } from "@/lib/webhooks";
import { slugify } from "@/lib/utils";
import { createPostSchema, postStatusValues } from "@/lib/validations/post";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

async function ensureUniqueSlug(baseSlug: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedResponse();
  }

  const { user } = session;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const filters: Prisma.PostWhereInput = {};
  if (status && (postStatusValues as readonly string[]).includes(status)) {
    filters.status = status as PostStatus;
  }
  if (user.role === "writer") {
    filters.authorId = user.id;
  }

  const posts = await prisma.post.findMany({
    where: Object.keys(filters).length ? filters : undefined,
    orderBy: { updatedAt: "desc" },
    include: { tags: { include: { tag: true } } },
  });

  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return unauthorizedResponse();
  }

  if (!can(session.user, "post:create")) {
    return forbiddenResponse();
  }

  const json = await request.json().catch(() => ({}));
  const data = createPostSchema.parse(json ?? {});

  const { user } = session;
  const isWriter = user.role === "writer";

  const title = data?.title?.trim() || "Untitled draft";
  const defaultSlugSource = data?.slug ?? title;
  const baseSlug = slugify(defaultSlugSource) || `untitled-${Date.now()}`;
  const slug = await ensureUniqueSlug(baseSlug);
  const normalizedTags = normalizeTags(data?.tags);
  const status = (isWriter ? "DRAFT" : data?.status ?? "DRAFT") as PostStatus;
  const publishedAt = !isWriter
    ? status === "PUBLISHED"
      ? new Date()
      : data?.publishedAt
        ? new Date(data.publishedAt)
        : null
    : null;

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      summary: data?.summary ?? null,
      contentMdx:
        data?.contentMdx ??
        `# ${title}\n\nStart writing your post. You can use **markdown** and <Callout>MDX</Callout> components.`,
      coverUrl: data?.coverUrl ?? null,
      status,
      publishedAt,
      authorId: user.id,
      tags: {
        create: normalizedTags.map((tagName) => {
          const slugged = slugify(tagName);
          return {
            tag: {
              connectOrCreate: {
                where: { slug: slugged },
                create: { name: tagName, slug: slugged },
              },
            },
          };
        }),
      },
    },
    include: { tags: { include: { tag: true } } },
  });

  await recordAuditLog({
    userId: session.user.id,
    action: "post:create",
    targetId: post.id,
    meta: { status: post.status },
  });

  if (post.status === "PUBLISHED") {
    await recordAuditLog({
      userId: session.user.id,
      action: "post:publish",
      targetId: post.id,
      meta: { slug: post.slug },
    });
    await triggerOutbound("post.published", {
      id: post.id,
      slug: post.slug,
      status: post.status,
    });
  }

  return NextResponse.json({ post }, { status: 201 });
}
