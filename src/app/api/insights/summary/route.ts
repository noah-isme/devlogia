import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getInsightsSummary } from "@/lib/analytics/insights";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range");
  const rangeDays = rangeParam ? Number.parseInt(rangeParam, 10) : 30;
  const safeRange = Number.isFinite(rangeDays) ? Math.min(Math.max(rangeDays, 7), 90) : 30;

  const summary = await getInsightsSummary(safeRange);

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
