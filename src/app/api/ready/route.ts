import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { fetchSchemaState } from "@/lib/version";

type ReadyStatus = "ok" | "fail" | "skip";

export async function GET() {
  const startedAt = Date.now();
  const maintenanceMode = process.env.MAINTENANCE_MODE === "true";

  const checks: Record<string, { status: ReadyStatus; details?: Record<string, unknown> }> = {
    maintenance: { status: maintenanceMode ? "fail" : "ok" },
  };

  let overall: ReadyStatus = maintenanceMode ? "fail" : "ok";

  if (!maintenanceMode && isDatabaseEnabled) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      const schema = await fetchSchemaState();
      const pending = schema.pending ?? 0;
      const dbStatus: ReadyStatus = pending > 0 ? "fail" : "ok";
      checks.database = {
        status: dbStatus,
        details: { pendingMigrations: pending, schemaVersion: schema.version },
      };
      if (dbStatus === "fail") {
        overall = "fail";
      }
    } catch (error) {
      logger.error({ err: error }, "Readiness database check failed");
      checks.database = {
        status: "fail",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      };
      overall = "fail";
    }
  } else if (!isDatabaseEnabled) {
    checks.database = { status: "skip", details: { reason: "database-disabled" } };
  }

  const statusCode = overall === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      status: overall,
      checks,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
