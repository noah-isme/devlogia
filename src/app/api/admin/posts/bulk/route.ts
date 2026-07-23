import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, postIds } = body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: "Select at least one post" }, { status: 400 });
    }

    if (action === "delete" && session.user.role === "writer") {
      return NextResponse.json({ error: "Forbidden: Writers cannot delete posts" }, { status: 403 });
    }

    let affectedCount = 0;

    if (action === "publish") {
      const result = await prisma.post.updateMany({
        where: { id: { in: postIds } },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
      affectedCount = result.count;
    } else if (action === "unpublish" || action === "draft") {
      const result = await prisma.post.updateMany({
        where: { id: { in: postIds } },
        data: { status: "DRAFT" },
      });
      affectedCount = result.count;
    } else if (action === "delete") {
      const result = await prisma.post.deleteMany({
        where: { id: { in: postIds } },
      });
      affectedCount = result.count;
    } else {
      return NextResponse.json({ error: "Invalid bulk action" }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "post:bulk_action",
        targetId: postIds.join(","),
        meta: { bulkAction: action, count: affectedCount, postIds },
      },
    });

    return NextResponse.json({ success: true, count: affectedCount });
  } catch (error) {
    console.error("Failed to execute bulk post action", error);
    return NextResponse.json({ error: "Failed to execute bulk action" }, { status: 500 });
  }
}
