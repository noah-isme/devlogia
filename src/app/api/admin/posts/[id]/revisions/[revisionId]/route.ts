import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string; revisionId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "post:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, revisionId } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, contentMdx: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const revision = await prisma.postRevision.findFirst({
    where: { id: revisionId, postId: id },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      contentMdx: true,
      coverUrl: true,
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
      ogImageUrl: true,
      status: true,
      publishedAt: true,
      reason: true,
      createdAt: true,
      userId: true,
    },
  });

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  return NextResponse.json({
    post: { id: post.id, title: post.title, slug: post.slug, contentMdx: post.contentMdx },
    revision,
  });
}