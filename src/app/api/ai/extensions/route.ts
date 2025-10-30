import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createAIExtension, listAIExtensions } from "@/lib/ai/extensions";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "ai:extensions:view")) {
    return forbidden();
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId query parameter is required" }, { status: 400 });
  }
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  if (includeInactive && !can(session.user, "ai:extensions:manage")) {
    return forbidden();
  }

  try {
    const extensions = await listAIExtensions({ tenantId, includeInactive });
    return NextResponse.json({ extensions }, { status: 200 });
  } catch (error) {
    logger.error({ err: error }, "Failed to list AI extensions");
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Failed to load extensions";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "ai:extensions:manage")) {
    return forbidden();
  }
  const payload = await request.json().catch(() => ({}));
  try {
    const extension = await createAIExtension(payload);
    return NextResponse.json({ extension }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create AI extension");
    const status = (error as { status?: number }).status ?? 400;
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status });
  }
}
