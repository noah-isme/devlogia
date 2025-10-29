import { prisma } from "@/lib/prisma";
import type { TenantPlanTier } from "@/lib/tenant";

import { calculatePlanLimits } from "./plans";

const DEFAULT_PLAN_SEATS: Record<TenantPlanTier, number> = {
  free: 5,
  pro: 25,
  enterprise: 100,
};

export type PlanQuotaOverrides = {
  aiTokensMonthly?: number;
  storageMB?: number;
  seats?: number;
  effectiveFrom?: Date;
};

function quotasEqual(a: { aiTokensMonthly: number; storageMB: number; seats: number }, b: typeof a) {
  return a.aiTokensMonthly === b.aiTokensMonthly && a.storageMB === b.storageMB && a.seats === b.seats;
}

export async function syncTenantPlanQuota(
  tenantId: string,
  plan: TenantPlanTier,
  overrides: PlanQuotaOverrides = {},
) {
  const limits = calculatePlanLimits(plan);
  const aiTokensMonthly = overrides.aiTokensMonthly ?? limits.quotas.ai.monthlyTokens;
  const storageMB = overrides.storageMB ?? limits.quotas.storage.maxMegabytes;
  const seats = overrides.seats ?? DEFAULT_PLAN_SEATS[plan];

  const now = overrides.effectiveFrom ?? new Date();
  const existing = await prisma.planQuota.findFirst({
    where: { tenantId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  if (existing && existing.plan === plan && quotasEqual(existing, { aiTokensMonthly, storageMB, seats })) {
    return existing;
  }

  if (existing) {
    await prisma.planQuota.update({
      where: { id: existing.id },
      data: { effectiveTo: now },
    });
  }

  return prisma.planQuota.create({
    data: {
      tenantId,
      plan,
      aiTokensMonthly,
      storageMB,
      seats,
      effectiveFrom: now,
    },
  });
}
