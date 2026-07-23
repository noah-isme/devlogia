import { NextResponse } from "next/server";

import { isDatabaseEnabled, prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!isDatabaseEnabled) {
    return NextResponse.json({ comments: [] });
  }

  try {
    const comments = await prisma.comment.findMany({
      where: { postId: id, status: "APPROVED" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        postId: true,
        parentId: true,
        authorName: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error(`Failed to fetch comments for post ${id}`, error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { authorName, authorEmail, content, parentId } = body;

    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      return NextResponse.json({ error: "Author name is required" }, { status: 400 });
    }

    if (!authorEmail || typeof authorEmail !== "string" || !authorEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment || parentComment.postId !== id) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 400 });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        postId: id,
        parentId: parentId || null,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim().toLowerCase(),
        content: content.trim(),
        status: "APPROVED",
      },
      select: {
        id: true,
        postId: true,
        parentId: true,
        authorName: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error(`Failed to create comment for post ${id}`, error);
    return NextResponse.json({ error: "Failed to submit comment" }, { status: 500 });
  }
}
