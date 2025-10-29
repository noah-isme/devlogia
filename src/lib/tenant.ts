import { z } from "zod";

const planSchema = z.enum(["free", "pro", "enterprise"] as const);
const tenantModeSchema = z.enum(["single", "multi"] as const);

export type TenantPlanTier = z.infer<typeof planSchema>;
export type TenantMode = z.infer<typeof tenantModeSchema>;
export type BillingProvider = "stripe" | "none" | "custom";

export type TenantConfig = {
  mode: TenantMode;
  isMultiTenant: boolean;
  defaultPlan: TenantPlanTier;
  supportedPlans: TenantPlanTier[];
  adminEmail: string | null;
  billing: {
    provider: BillingProvider;
    stripeSecretKey: string | null;
    stripeWebhookSecret: string | null;
    stripeConnectClientId: string | null;
    stripePublishableKey: string | null;
    platformFeePercentage: number;
    marketplaceTaxRegion: string | null;
    invoicePrefix: string;
  };
  federation: {
    indexUrl: string | null;
    apiKey: string | null;
    cacheTtlSeconds: number;
  };
  sdk: {
    token: string | null;
  };
};

export type TenantReadinessIssue = {
  code: string;
  level: "error" | "warning";
  message: string;
};

const SUPPORTED_PLANS: TenantPlanTier[] = ["free", "pro", "enterprise"];
const FEDERATION_CACHE_TTL_SECONDS = 600;

function normalizeMode(value: string | undefined): TenantMode {
  const parsed = tenantModeSchema.safeParse((value ?? "single").toLowerCase());
  return parsed.success ? parsed.data : "single";
}

function normalizePlan(value: string | undefined): TenantPlanTier {
  const parsed = planSchema.safeParse((value ?? "free").toLowerCase());
  return parsed.success ? parsed.data : "free";
}

function normalizeBillingProvider(value: string | undefined): BillingProvider {
  if (!value) {
    return "none";
  }
  const lower = value.trim().toLowerCase();
  if (lower === "stripe") return "stripe";
  if (lower === "none") return "none";
  return "custom";
}

function normalizeEmail(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = z.string().email().safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

function normalizeUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const parsed = z.string().url().safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

function normalizeToken(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePercentage(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const normalized = Number.parseFloat(value);
  if (Number.isNaN(normalized) || normalized < 0 || normalized > 1) {
    return fallback;
  }

  return Math.round(normalized * 10_000) / 10_000;
}

function normalizeTaxRegion(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeInvoicePrefix(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 && trimmed.length <= 12 ? trimmed : fallback;
}

export function createTenantConfig(env: Record<string, string | undefined> = process.env): TenantConfig {
  const mode = normalizeMode(env.TENANT_MODE);
  const defaultPlan = normalizePlan(env.TENANT_DEFAULT_PLAN);
  const billingProvider = normalizeBillingProvider(env.BILLING_PROVIDER);

  return {
    mode,
    isMultiTenant: mode === "multi",
    defaultPlan,
    supportedPlans: [...SUPPORTED_PLANS],
    adminEmail: normalizeEmail(env.TENANT_ADMIN_EMAIL),
    billing: {
      provider: billingProvider,
      stripeSecretKey: normalizeToken(env.STRIPE_SECRET_KEY),
      stripeWebhookSecret: normalizeToken(env.STRIPE_WEBHOOK_SECRET),
      stripeConnectClientId: normalizeToken(env.STRIPE_CONNECT_CLIENT_ID),
      stripePublishableKey: normalizeToken(env.STRIPE_PUBLISHABLE_KEY),
      platformFeePercentage: normalizePercentage(env.PLATFORM_FEE_PCT, 0.15),
      marketplaceTaxRegion: normalizeTaxRegion(env.MARKETPLACE_TAX_REGION),
      invoicePrefix: normalizeInvoicePrefix(env.INVOICE_PREFIX, "DEV"),
    },
    federation: {
      indexUrl: normalizeUrl(env.FEDERATION_INDEX_URL),
      apiKey: normalizeToken(env.FEDERATION_API_KEY),
      cacheTtlSeconds: FEDERATION_CACHE_TTL_SECONDS,
    },
    sdk: {
      token: normalizeToken(env.DEVLOGIA_SDK_TOKEN),
    },
  } satisfies TenantConfig;
}

export const tenantConfig = createTenantConfig();

export function evaluateTenantReadiness(config: TenantConfig): TenantReadinessIssue[] {
  const issues: TenantReadinessIssue[] = [];

  if (config.isMultiTenant) {
    if (!config.adminEmail) {
      issues.push({
        code: "TENANT_ADMIN_EMAIL_MISSING",
        level: "error",
        message: "TENANT_ADMIN_EMAIL must be a valid email when TENANT_MODE=multi.",
      });
    }

    if (config.billing.provider === "stripe") {
      if (!config.billing.stripeSecretKey) {
        issues.push({
          code: "STRIPE_SECRET_MISSING",
          level: "error",
          message: "STRIPE_SECRET_KEY must be configured for Stripe billing.",
        });
      }
      if (!config.billing.stripeWebhookSecret) {
        issues.push({
          code: "STRIPE_WEBHOOK_MISSING",
          level: "error",
          message: "STRIPE_WEBHOOK_SECRET must be configured for Stripe billing.",
        });
      }
      if (!config.billing.stripeConnectClientId) {
        issues.push({
          code: "STRIPE_CONNECT_CLIENT_ID_MISSING",
          level: "warning",
          message: "STRIPE_CONNECT_CLIENT_ID is recommended to enable Connect onboarding links.",
        });
      }
      if (!config.billing.stripePublishableKey) {
        issues.push({
          code: "STRIPE_PUBLISHABLE_KEY_MISSING",
          level: "warning",
          message: "STRIPE_PUBLISHABLE_KEY is missing; client-side checkout flows may fail.",
        });
      }
      if (!config.billing.marketplaceTaxRegion) {
        issues.push({
          code: "MARKETPLACE_TAX_REGION_MISSING",
          level: "warning",
          message: "MARKETPLACE_TAX_REGION should be configured for accurate invoice tax metadata.",
        });
      }
    } else {
      issues.push({
        code: "BILLING_PROVIDER_DISABLED",
        level: "warning",
        message: "Billing provider is not enabled; subscription upgrades will be unavailable.",
      });
    }

    if (!config.federation.indexUrl) {
      issues.push({
        code: "FEDERATION_URL_MISSING",
        level: "error",
        message: "FEDERATION_INDEX_URL must be a valid URL for cross-tenant recommendations.",
      });
    }

    if (!config.federation.apiKey) {
      issues.push({
        code: "FEDERATION_API_KEY_MISSING",
        level: "warning",
        message: "FEDERATION_API_KEY is missing; federation publishing will run in dry-run mode.",
      });
    }

    if (!config.sdk.token) {
      issues.push({
        code: "SDK_TOKEN_MISSING",
        level: "warning",
        message: "DEVLOGIA_SDK_TOKEN is not set; external SDK clients cannot authenticate.",
      });
    }
  }

  return issues;
}

export function assertTenantReadiness(config: TenantConfig = tenantConfig) {
  const issues = evaluateTenantReadiness(config);
  const blocking = issues.filter((issue) => issue.level === "error");
  if (blocking.length > 0) {
    const error = new Error(
      `Tenant configuration is invalid: ${blocking.map((issue) => `[${issue.code}] ${issue.message}`).join(", ")}`,
    );
    throw error;
  }
}
