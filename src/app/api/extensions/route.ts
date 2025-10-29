import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { listExtensions, registerExtension } from "@/lib/plugins/registry";
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
  const pluginId = url.searchParams.get("pluginId") ?? undefined;
  const includePrivate = url.searchParams.get("includePrivate") === "true";

  if (includePrivate && !can(session.user, "marketplace:manage")) {
    return forbidden();
  }

  try {
    const extensions = await listExtensions({ tenantId, pluginId, includePrivate });
    return NextResponse.json({ extensions }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "Failed to list extensions");
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
    const extension = await registerExtension(raw, {
      actorId: session.user.id,
      publisherTenantId: typeof raw?.publisherTenantId === "string" ? raw.publisherTenantId : undefined,
    });
    return NextResponse.json({ extension }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Failed to register extension");
    let status = 400;
    if (error instanceof Error) {
      if (error.message === "Database is not available") {
        status = 503;
      } else if (error.message === "Forbidden") {
        status = 403;
      }
    }
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status });
  }
}
