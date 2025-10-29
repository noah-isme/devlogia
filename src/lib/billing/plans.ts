import type { TenantPlanTier } from "@/lib/tenant";

export type PlanQuota = {
  ai: {
    monthlyTokens: number;
  };
  storage: {
    maxMegabytes: number;
  };
};

const DEFAULT_PLAN_QUOTAS: Record<TenantPlanTier, PlanQuota> = {
  free: {
    ai: { monthlyTokens: 10_000 },
    storage: { maxMegabytes: 2_048 },
  },
  pro: {
    ai: { monthlyTokens: 120_000 },
    storage: { maxMegabytes: 12_288 },
  },
  enterprise: {
    ai: { monthlyTokens: 1_200_000 },
    storage: { maxMegabytes: 61_440 },
  },
};

export type PlanConfiguration = {
  plan: TenantPlanTier;
  priceId: string | null;
  quotas: PlanQuota;
};

const priceIdEnv: Record<TenantPlanTier, string | null> = {
  free: null,
  pro: process.env.STRIPE_PRICE_PRO ?? null,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
};

export function resolvePlanConfiguration(plan: TenantPlanTier): PlanConfiguration {
  const quotas = DEFAULT_PLAN_QUOTAS[plan];
  const priceId = priceIdEnv[plan] ?? null;

  return {
    plan,
    priceId: priceId && priceId.trim().length > 0 ? priceId : null,
    quotas,
  };
}

export function findPlanByPrice(priceId: string | null | undefined): TenantPlanTier | null {
  if (!priceId) {
    return null;
  }

  const normalized = priceId.trim();
  const entry = (Object.entries(priceIdEnv) as Array<[TenantPlanTier, string | null]>).find(
    ([, candidate]) => candidate && candidate.trim() === normalized,
  );

  return entry ? entry[0] : null;
}

export function calculatePlanLimits(plan: TenantPlanTier) {
  const config = resolvePlanConfiguration(plan);
  return {
    plan: config.plan,
    quotas: config.quotas,
    updatedAt: new Date().toISOString(),
  };
}
