import { describe, expect, it } from "vitest";

import { createTenantConfig, evaluateTenantReadiness } from "@/lib/tenant";

describe("tenant configuration", () => {
  it("defaults to single-tenant mode", () => {
    const config = createTenantConfig({});
    expect(config.mode).toBe("single");
    expect(config.defaultPlan).toBe("free");
    expect(config.isMultiTenant).toBe(false);
  });

  it("flags missing Stripe secrets when billing is enabled", () => {
    const config = createTenantConfig({
      TENANT_MODE: "multi",
      BILLING_PROVIDER: "stripe",
      TENANT_ADMIN_EMAIL: "owner@example.com",
      FEDERATION_INDEX_URL: "https://federation.devlogia.network",
    });

    const issues = evaluateTenantReadiness(config);
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("STRIPE_SECRET_MISSING");
    expect(codes).toContain("STRIPE_WEBHOOK_MISSING");
    expect(codes).toContain("STRIPE_CONNECT_CLIENT_ID_MISSING");
    expect(codes).toContain("STRIPE_PUBLISHABLE_KEY_MISSING");
    expect(codes).toContain("MARKETPLACE_TAX_REGION_MISSING");
  });

  it("passes readiness checks when required values are present", () => {
    const config = createTenantConfig({
      TENANT_MODE: "multi",
      TENANT_DEFAULT_PLAN: "pro",
      TENANT_ADMIN_EMAIL: "owner@example.com",
      BILLING_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_ready",
      STRIPE_WEBHOOK_SECRET: "whsec_ready",
      STRIPE_CONNECT_CLIENT_ID: "ca_ready",
      STRIPE_PUBLISHABLE_KEY: "pk_ready",
      PLATFORM_FEE_PCT: "0.25",
      MARKETPLACE_TAX_REGION: "ID",
      INVOICE_PREFIX: "READY",
      FEDERATION_INDEX_URL: "https://federation.devlogia.network",
      FEDERATION_API_KEY: "federation-key",
      DEVLOGIA_SDK_TOKEN: "sdk-token",
    });

    const issues = evaluateTenantReadiness(config);
    const blocking = issues.filter((issue) => issue.level === "error");

    expect(blocking).toHaveLength(0);
  });
});
