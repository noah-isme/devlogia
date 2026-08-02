import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

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
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, email: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
        sessions: { where: { active: true }, include: { presence: true } },
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ workspace }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to load workspace");
    const message = error instanceof Error ? error.message : "Failed to load workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const updateSchema = {
  name: ["string", "min:3", "max:191"],
  slug: ["string", "min:3", "max:191"],
};

function parseUpdateBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request body", status: 400 as number };
  }

  const data: Record<string, unknown> = {};
  const entries = Object.entries(body as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (!["name", "slug"].includes(key)) {
      continue;
    }
    if (typeof value !== "string" || value.length < 3 || value.length > 191) {
      return { error: `Invalid ${key}`, status: 400 };
    }
    data[key] = key === "slug" ? slugify(value) : value.trim();
  }

  if (!Object.keys(data).length) {
    return { error: "No updatable fields provided", status: 400 };
  }

  return { data, status: 200 };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:manage")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateBody(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      );
    }

    const workspace = await prisma.workspace.update({
      where: { id },
      data: parsed.data,
      include: {
        creator: { select: { id: true, email: true } },
        members: { include: { user: { select: { id: true, email: true } } } },
        sessions: { where: { active: true }, include: { presence: true } },
      },
    });

    return NextResponse.json({ workspace }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to update workspace");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "workspace:manage")) {
    return forbidden();
  }

  const { id } = await params;

  try {
    if (!isDatabaseEnabled) {
      return NextResponse.json(
        { error: "Database unavailable" },
        { status: 503 },
      );
    }

    await prisma.workspace.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error({ err: error, workspaceId: id }, "Failed to delete workspace");
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
