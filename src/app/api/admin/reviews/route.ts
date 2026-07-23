import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { safeFindMany } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = session;
  if (user.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const reviewPosts = await safeFindMany("post", {
      where: {
        status: { in: ["IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"] },
        ...(user.role === "writer" ? { authorId: user.id } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json({ posts: reviewPosts });
  } catch (error) {
    console.error("Failed to fetch review tasks", error);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}
