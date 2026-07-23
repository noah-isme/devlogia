import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import type { CommentStatus } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
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
    const body = await request.json();
    const status: CommentStatus = body.status;

    if (status !== "APPROVED" && status !== "PENDING" && status !== "SPAM") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await prisma.comment.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "comment:update_status",
        targetId: id,
        meta: { newStatus: status },
      },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error(`Failed to update comment ${id}`, error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "viewer" || session.user.role === "writer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    await prisma.comment.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "comment:delete",
        targetId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Failed to delete comment ${id}`, error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
