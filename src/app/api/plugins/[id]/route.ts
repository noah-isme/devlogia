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
  if (!can(session.user, "marketplace:view")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const plugin = await prisma.plugin.findUnique({
      where: { id },
      include: {
        extensions: true,
        _count: { select: { installs: true } },
      },
    });

    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    return NextResponse.json({ plugin }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, pluginId: id }, "Failed to load plugin");
    const message = error instanceof Error ? error.message : "Failed to load plugin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "marketplace:publish")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const allowedFields = new Set(["name", "summary", "description", "version", "visibility", "repositoryUrl", "websiteUrl", "metadata"]);
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (!allowedFields.has(key)) {
        continue;
      }
      if (key === "metadata" && typeof value === "object" && !Array.isArray(value)) {
        updates.metadata = value;
        continue;
      }
      if (typeof value === "string" && value.length <= 512) {
        updates[key] = value.trim();
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const plugin = await prisma.plugin.update({
      where: { id },
      data: updates,
      include: {
        extensions: true,
        _count: { select: { installs: true } },
      },
    });

    return NextResponse.json({ plugin }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, pluginId: id }, "Failed to update plugin");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update plugin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "marketplace:manage")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    await prisma.plugin.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, pluginId: id }, "Failed to delete plugin");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete plugin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
