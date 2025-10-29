import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildRevenueReport, getRevenueSummary } from "@/lib/billing/revenue";
import { logger } from "@/lib/logger";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (!can(session.user, "billing:manage") && !can(session.user, "billing:view")) {
    return forbidden();
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  try {
    const summary = await getRevenueSummary({
      tenantId: tenantId ?? undefined,
      from: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
      to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
    });

    if (format === "csv" || format === "pdf") {
      const report = buildRevenueReport(summary, format as "csv" | "pdf");
      return new NextResponse(report.buffer, {
        status: 200,
        headers: {
          "content-type": report.contentType,
          "content-disposition": `attachment; filename=devlogia-revenue.${format}`,
        },
      });
    }

    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "Failed to generate revenue summary");
    return NextResponse.json({ error: "Unable to load revenue summary" }, { status: 500 });
  }
}
