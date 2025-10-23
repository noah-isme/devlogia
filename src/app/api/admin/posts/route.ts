import { NextResponse } from "next/server";

import type { PostStatus, Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const where: Prisma.PostWhereInput | undefined =
    status && (postStatusValues as readonly string[]).includes(status)
      ? { status: status as PostStatus }
      : undefined;

  const posts = await prisma.post.findMany({
    where,
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

  if (session.user.role !== "admin") {
    return forbiddenResponse();
  }

  const json = await request.json().catch(() => ({}));
  const data = createPostSchema.parse(json ?? {});

  const title = data?.title?.trim() || "Untitled draft";
  const defaultSlugSource = data?.slug ?? title;
  const baseSlug = slugify(defaultSlugSource) || `untitled-${Date.now()}`;
  const slug = await ensureUniqueSlug(baseSlug);
  const normalizedTags = normalizeTags(data?.tags);
  const status = data?.status ?? "DRAFT";

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
      publishedAt:
        status === "PUBLISHED"
          ? new Date()
          : data?.publishedAt
            ? new Date(data.publishedAt)
            : null,
      authorId: session.user.id,
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

  return NextResponse.json({ post }, { status: 201 });
}
