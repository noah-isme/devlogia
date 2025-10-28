import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getRateLimitDiagnostics } from "@/lib/ratelimit";
import { initRedis } from "@/lib/redis";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { storageHealthCheck } from "@/lib/storage";
import { fetchSchemaState, getVersionMetadata } from "@/lib/version";

const version = getVersionMetadata();

type ComponentStatus = "ok" | "error" | "disabled";

type CheckResult = {
  status: ComponentStatus;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
};

async function checkDatabase(): Promise<CheckResult> {
  if (!isDatabaseEnabled) {
    return { status: "disabled" };
  }

  const started = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    const schema = await fetchSchemaState();
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      details: { schemaVersion: schema.version, pendingMigrations: schema.pending },
    };
  } catch (error) {
    logger.error({ err: error }, "Database health check failed");
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  if (!process.env.RATE_LIMIT_REDIS_URL) {
    return { status: "disabled" };
  }

  const redis = await initRedis();
  if (!redis) {
    return { status: "error", error: "Unable to connect" };
  }

  const started = Date.now();
  try {
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ok" : "error",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    logger.error({ err: error }, "Redis health check failed");
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const database = await checkDatabase();
  const storageResult = await storageHealthCheck();
  const redis = await checkRedis();

  const storage: CheckResult = {
    status: storageResult.status,
    details: { provider: storageResult.provider },
    error: storageResult.status === "error" ? storageResult.error?.message ?? "Unknown error" : undefined,
  };

  const statuses: ComponentStatus[] = [database.status, storage.status, redis.status];
  const hasError = statuses.includes("error");
  const hasOk = statuses.includes("ok");

  const overall = hasError ? (hasOk ? "degraded" : "error") : "ok";
  const statusCode = overall === "error" ? 503 : 200;

  const rateLimit = getRateLimitDiagnostics();

  return NextResponse.json(
    {
      status: overall,
      durationMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      version,
      checks: {
        database,
        storage,
        redis,
        rateLimit,
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
