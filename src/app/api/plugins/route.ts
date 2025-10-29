import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { listPlugins, publishPlugin } from "@/lib/plugins/registry";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const includePrivate = url.searchParams.get("includePrivate") === "true";

  if (includePrivate && !can(session.user, "marketplace:manage")) {
    return forbidden();
  }

  try {
    const plugins = await listPlugins({ tenantId: tenantId ?? undefined, includePrivate });
    return NextResponse.json({ plugins }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "Failed to list plugins");
    const status = (error as { status?: number }).status ?? 400;
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (!can(session.user, "marketplace:publish")) {
    return forbidden();
  }

  const raw = await request.json().catch(() => ({}));

  try {
    const plugin = await publishPlugin(raw, {
      actorId: session.user.id,
      publisherTenantId: typeof raw?.publisherTenantId === "string" ? raw.publisherTenantId : undefined,
    });
    return NextResponse.json({ plugin }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Failed to publish plugin");
    const status = error instanceof Error && error.message === "Database is not available" ? 503 : 400;
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status });
  }
}
