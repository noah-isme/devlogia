#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { PrismaClient } from "@prisma/client";

import { refreshTenantAnalytics } from "@/lib/analytics/tenant";
import { logger } from "@/lib/logger";
import { recordEtlRun } from "@/lib/metrics/advanced";

const prisma = new PrismaClient();

async function sendAlert(message: string) {
  const webhook = process.env.ANALYTICS_ALERT_WEBHOOK;
  if (!webhook) {
    logger.warn({ message }, "Analytics alert webhook not configured");
    return;
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to send analytics alert");
  }
}

async function main() {
  const startedAt = performance.now();
  let succeeded = true;

  try {
    const { rows, durationMs } = await refreshTenantAnalytics(prisma);
    const runtime = Number(durationMs.toFixed(0));
    logger.info({ runtime, tenants: rows.length }, "analytics-refresh completed");

    const output = {
      generatedAt: new Date().toISOString(),
      runtimeMs: runtime,
      tenantCount: rows.length,
      rows,
    };

    if (process.env.ANALYTICS_REFRESH_SNAPSHOT) {
      writeFileSync(process.env.ANALYTICS_REFRESH_SNAPSHOT, JSON.stringify(output, null, 2));
    }
  } catch (error) {
    succeeded = false;
    logger.error({ err: error }, "analytics-refresh failed");
    recordEtlRun({ success: false });
    await sendAlert(`:warning: analytics-refresh failed – ${(error as Error).message}`);
  } finally {
    const elapsed = performance.now() - startedAt;
    if (!succeeded) {
      await prisma.$disconnect();
      process.exitCode = 1;
    } else {
      await prisma.$disconnect();
    }
    if (!succeeded) {
      logger.warn({ elapsedMs: Number(elapsed.toFixed(0)) }, "analytics-refresh finished with errors");
    }
  }
}

void main();
