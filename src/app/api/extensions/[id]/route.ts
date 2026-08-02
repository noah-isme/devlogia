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

    const extension = await prisma.extension.findUnique({
      where: { id },
      include: {
        plugin: { select: { id: true, name: true, slug: true, visibility: true } },
        _count: { select: { usages: true } },
      },
    });

    if (!extension) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }

    return NextResponse.json({ extension }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, extensionId: id }, "Failed to load extension");
    const message = error instanceof Error ? error.message : "Failed to load extension";
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

    const allowedFields = new Set(["name", "description", "surface", "runtime", "entrypoint", "configSchema", "sandboxConfig", "metadata", "targetTenantId", "active"]);
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (!allowedFields.has(key)) {
        continue;
      }
      if (key === "metadata" && typeof value === "object" && !Array.isArray(value)) {
        updates.metadata = value;
        continue;
      }
      if (key === "sandboxConfig" && typeof value === "object" && !Array.isArray(value)) {
        updates.sandboxConfig = value;
        continue;
      }
      if (key === "configSchema" && typeof value === "object" && !Array.isArray(value)) {
        updates.configSchema = value;
        continue;
      }
      if (typeof value === "string" && value.length <= 512) {
        updates[key] = value.trim();
      }
      if (key === "active" && typeof value === "boolean") {
        updates.active = value;
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const extension = await prisma.extension.update({
      where: { id },
      data: updates,
      include: {
        plugin: { select: { id: true, name: true, slug: true, visibility: true } },
        _count: { select: { usages: true } },
      },
    });

    return NextResponse.json({ extension }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, extensionId: id }, "Failed to update extension");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update extension";
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

    await prisma.extension.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, extensionId: id }, "Failed to delete extension");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete extension";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
