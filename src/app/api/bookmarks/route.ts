import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isDatabaseEnabled) {
    return NextResponse.json({ bookmarks: [] });
  }

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        postId: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            coverUrl: true,
            publishedAt: true,
            tags: { select: { tag: { select: { name: true, slug: true } } } },
          },
        },
      },
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error("Failed to fetch bookmarks", error);
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json().catch(() => ({}));
  const { postId } = body;

  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
  }

  if (!session?.user?.id || !isDatabaseEnabled) {
    // Return mock response for unauthenticated/guest users so frontend can rely on localStorage fallback
    return NextResponse.json({ bookmarked: true, guest: true });
  }

  try {
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId: session.user.id,
          postId,
        },
      },
    });

    if (existing) {
      await prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ bookmarked: false });
    }

    await prisma.bookmark.create({
      data: {
        userId: session.user.id,
        postId,
      },
    });

    return NextResponse.json({ bookmarked: true });
  } catch (error) {
    console.error(`Failed to toggle bookmark for post ${postId}`, error);
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}
