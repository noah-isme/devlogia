#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";

import { logger } from "@/lib/logger";
import { recordSignatureVerification } from "@/lib/metrics/advanced";

const prisma = new PrismaClient();

type AuditIncident = {
  id: string;
  tenantId: string | null;
  actorTenantId: string | null;
  createdAt: Date;
};

async function detectCrossTenantAccess(windowHours = 24) {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, meta: true, createdAt: true },
  });

  const incidents: AuditIncident[] = [];

  for (const log of logs) {
    const meta = (log.meta as Record<string, unknown>) ?? {};
    const tenantId = typeof meta.tenantId === "string" ? meta.tenantId : null;
    const actorTenantId = typeof meta.actorTenantId === "string" ? meta.actorTenantId : null;
    if (tenantId && actorTenantId && tenantId !== actorTenantId) {
      incidents.push({ id: log.id, tenantId, actorTenantId, createdAt: log.createdAt });
    }
  }

  return incidents;
}

async function main() {
  const incidents = await detectCrossTenantAccess();
  const failRate = incidents.length;
  if (failRate > 0) {
    logger.error({ incidents }, "Cross-tenant access detected");
  } else {
    logger.info("No cross-tenant incidents detected");
  }

  recordSignatureVerification({ success: failRate === 0 });

  if (process.env.SECURITY_ALERT_WEBHOOK && failRate > 0) {
    try {
      await fetch(process.env.SECURITY_ALERT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `:rotating_light: ${failRate} cross-tenant incident(s) detected in the last 24h`,
        }),
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to deliver security alert");
    }
  }

  await prisma.$disconnect();

  if (failRate > 0) {
    process.exitCode = 2;
  }
}

void main();
