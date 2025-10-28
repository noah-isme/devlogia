import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getInsightsSummary } from "@/lib/analytics/insights";
import { generateInsightsReport } from "@/lib/analytics/report";
import { markdownToReportBuffer } from "@/lib/pdf";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function parseRange(param: string | null) {
  if (!param) return 30;
  const value = Number.parseInt(param, 10);
  if (!Number.isFinite(value)) return 30;
  return Math.min(Math.max(value, 7), 90);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const range = parseRange(typeof body.range === "string" ? body.range : null);
  const summary = await getInsightsSummary(range);
  const markdown = await generateInsightsReport(summary, { timeframe: `${range}-day` });

  return NextResponse.json({
    report: markdown,
    summary,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "markdown").toLowerCase() === "pdf" ? "pdf" : "markdown";
  const range = parseRange(url.searchParams.get("range"));

  const summary = await getInsightsSummary(range);
  const markdown = await generateInsightsReport(summary, { timeframe: `${range}-day` });
  const { buffer, contentType } = markdownToReportBuffer(markdown, format);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=devlogia-insights-${summary.range.end}.${format === "pdf" ? "pdf" : "md"}`,
      "Cache-Control": "no-store",
    },
  });
}
