import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { upsertPostSchema } from "@/lib/validations/post";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
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

async function ensureUniqueSlug(baseSlug: string, excludeId: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? baseSlug : `${baseSlug}-${counter}`;
    const existing = await prisma.post.findFirst({
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

  return NextResponse.json({ post });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return unauthorizedResponse();
  }

  if (session.user.role !== "admin") {
    return forbiddenResponse();
  }

  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) {
    return notFoundResponse();
  }

  const json = await request.json().catch(() => ({}));
  const data = upsertPostSchema.parse(json);

  const normalizedTags = normalizeTags(data.tags);
  const baseSlug = slugify(data.slug);
  const slug = await ensureUniqueSlug(baseSlug, id);

  const publishedAt = (() => {
    if (data.status === "PUBLISHED") {
      if (data.publishedAt) {
        return new Date(data.publishedAt);
      }
      return post.publishedAt ?? new Date();
    }

    if (data.publishedAt) {
      return new Date(data.publishedAt);
    }

    return null;
  })();

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      contentMdx: data.contentMdx,
      coverUrl: data.coverUrl ?? null,
      status: data.status,
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

  return NextResponse.json({ post: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return unauthorizedResponse();
  }

  if (session.user.role !== "admin") {
    return forbiddenResponse();
  }
  await prisma.post.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
