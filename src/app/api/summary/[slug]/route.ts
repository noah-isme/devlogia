import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recordRequestMetrics } from "@/lib/metrics";
import { getPostSummary } from "@/lib/personalization/summary";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const startedAt = Date.now();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  const { slug } = await context.params;

  const summary = await getPostSummary(slug, { userId, force });
  if (!summary) {
    recordRequestMetrics({ status: 404, durationMs: Date.now() - startedAt });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  recordRequestMetrics({ status: 200, durationMs: Date.now() - startedAt });
  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Summary-Model": summary.model,
      "X-Summary-Cached": summary.cached ? "1" : "0",
    },
  });
}
