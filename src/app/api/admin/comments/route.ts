import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import type { CommentStatus } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json({ comments: [] });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const validStatus: CommentStatus | undefined =
    statusParam === "APPROVED" || statusParam === "PENDING" || statusParam === "SPAM"
      ? statusParam
      : undefined;

  try {
    const comments = await prisma.comment.findMany({
      where: validStatus ? { status: validStatus } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        postId: true,
        parentId: true,
        authorName: true,
        authorEmail: true,
        content: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Failed to fetch admin comments", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}
