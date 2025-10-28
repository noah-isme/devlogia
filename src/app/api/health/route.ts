import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { storageHealthCheck } from "@/lib/storage";

const version = process.env.npm_package_version ?? "dev";

type ComponentStatus = "ok" | "error" | "disabled";

export async function GET() {
  const startedAt = Date.now();
  let database: { status: ComponentStatus; latencyMs?: number; error?: string } = { status: "disabled" };

  if (isDatabaseEnabled) {
    const dbStart = Date.now();
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      database = { status: "ok", latencyMs: Date.now() - dbStart };
    } catch (error) {
      logger.error({ err: error }, "Database health check failed");
      database = { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  const storageResult = await storageHealthCheck();
  const storage: { status: ComponentStatus; provider: string; error?: string } = {
    status: storageResult.status,
    provider: storageResult.provider,
    error: storageResult.status === "error" ? storageResult.error?.message ?? "Unknown error" : undefined,
  };

  const statuses: ComponentStatus[] = [database.status, storage.status];
  const hasError = statuses.includes("error");
  const hasOk = statuses.includes("ok");

  const overall = hasError ? (hasOk ? "degraded" : "error") : "ok";
  const statusCode = overall === "error" ? 503 : 200;

  return NextResponse.json(
    {
      status: overall,
      version,
      durationMs: Date.now() - startedAt,
      checks: {
        database,
        storage,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
