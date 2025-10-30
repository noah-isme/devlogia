import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { logAIExtensionUsage } from "@/lib/ai/extensions";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "ai:use")) {
    return forbidden();
  }

  const payload = await request.json().catch(() => ({}));
  try {
    const result = await logAIExtensionUsage(payload);
    return NextResponse.json({
      logId: result.logId,
      quota: result.quota.status,
      warnings: result.quota.triggered,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to record AI usage");
    const status = (error as { status?: number }).status ?? 400;
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status });
  }
}
