import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:view")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({ members: [] }, { status: 200 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: { user: { select: { id: true, email: true, isActive: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to list workspace members");
    const message = error instanceof Error ? error.message : "Failed to list members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:manage")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const userId = (payload as { userId?: string }).userId;
    const role = (payload as { role?: string }).role ?? "EDITOR";

    if (!userId || !["OWNER", "EDITOR", "VIEWER"].includes(role)) {
      return NextResponse.json({ error: "userId and valid role are required" }, { status: 400 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const member = await prisma.workspaceMember.create({
      data: { workspaceId: id, userId, role: role as "OWNER" | "EDITOR" | "VIEWER" },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to add workspace member");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to add member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:manage")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    const payload = await request.json().catch(() => null);
    const userId = payload && typeof payload === "object" ? (payload as { userId?: string }).userId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: id, userId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to remove workspace member");
    const message = error instanceof Error ? error.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
