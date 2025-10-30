import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const WARNING_THRESHOLD = 0.8;

export type QuotaWarningLevel = "warning" | "critical";

export type QuotaWarning = {
  level: QuotaWarningLevel;
  threshold: number;
  utilization: number;
  message: string;
};

export type QuotaStatus = {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number;
  warnings: QuotaWarning[];
};

export type QuotaApplicationResult = {
  status: QuotaStatus;
  triggered: QuotaWarning[];
};

function getMonthStart(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  return start;
}

function buildStatus(limit: number | null, used: number): QuotaStatus {
  if (limit === null || limit <= 0) {
    return {
      limit: null,
      used,
      remaining: null,
      utilization: 0,
      warnings: [],
    } satisfies QuotaStatus;
  }

  const utilization = used / limit;
  const remaining = Math.max(0, limit - used);
  const warnings: QuotaWarning[] = [];

  if (utilization >= 1) {
    warnings.push({
      level: "critical",
      threshold: 1,
      utilization,
      message: "AI quota exhausted for current billing period.",
    });
  } else if (utilization >= WARNING_THRESHOLD) {
    warnings.push({
      level: "warning",
      threshold: WARNING_THRESHOLD,
      utilization,
      message: "AI quota usage exceeded 80% for current billing period.",
    });
  }

  return {
    limit,
    used,
    remaining,
    utilization,
    warnings,
  } satisfies QuotaStatus;
}

async function fetchTenantLimit(tenantId: string): Promise<number | null> {
  if (!isDatabaseEnabled) {
    return null;
  }
  const record = await prisma.planQuota.findFirst({
    where: {
      tenantId,
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!record) {
    return null;
  }
  return record.aiTokensMonthly ?? null;
}

async function fetchTenantUsage(tenantId: string): Promise<number> {
  if (!isDatabaseEnabled) {
    return 0;
  }
  const start = getMonthStart();
  const aggregate = await prisma.aIUsageLog.aggregate({
    where: {
      tenantId,
      createdAt: {
        gte: start,
      },
    },
    _sum: {
      tokensUsed: true,
    },
  });
  return aggregate._sum.tokensUsed ?? 0;
}

export async function getTenantQuotaStatus(tenantId: string): Promise<QuotaStatus> {
  const [limit, used] = await Promise.all([fetchTenantLimit(tenantId), fetchTenantUsage(tenantId)]);
  return buildStatus(limit, used);
}

function calculateThresholdTriggers(limit: number | null, before: number, after: number): QuotaWarning[] {
  if (limit === null || limit <= 0) {
    return [];
  }
  const thresholds: Array<{ level: QuotaWarningLevel; ratio: number; message: string }> = [
    { level: "warning", ratio: WARNING_THRESHOLD, message: "AI quota usage exceeded 80% of allocation." },
    { level: "critical", ratio: 1, message: "AI quota exceeded for current cycle." },
  ];
  const triggered: QuotaWarning[] = [];
  for (const threshold of thresholds) {
    if (before / limit < threshold.ratio && after / limit >= threshold.ratio) {
      triggered.push({
        level: threshold.level,
        threshold: threshold.ratio,
        utilization: after / limit,
        message: threshold.message,
      });
    }
  }
  return triggered;
}

export async function applyQuotaUsage(tenantId: string, tokensUsed: number): Promise<QuotaApplicationResult> {
  if (tokensUsed < 0) {
    throw new Error("tokensUsed must be non-negative");
  }
  const [limit, currentUsed] = await Promise.all([fetchTenantLimit(tenantId), fetchTenantUsage(tenantId)]);
  const prospective = currentUsed + tokensUsed;
  if (limit !== null && limit > 0 && prospective > limit) {
    const error = new Error("AI quota exceeded");
    (error as Error & { status?: number }).status = 402;
    throw error;
  }
  const status = buildStatus(limit, prospective);
  const triggered = calculateThresholdTriggers(limit, currentUsed, prospective);
  for (const warning of triggered) {
    if (warning.level === "critical") {
      logger.error({ tenantId, utilization: warning.utilization }, warning.message);
    } else {
      logger.warn({ tenantId, utilization: warning.utilization }, warning.message);
    }
  }
  return { status, triggered } satisfies QuotaApplicationResult;
}

export { getMonthStart };
