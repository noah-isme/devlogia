import { createConnectOnboardingLink } from "../src/lib/billing/accounts";
import { prisma } from "../src/lib/prisma";
import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const tenantId = process.argv[2];
  const returnUrl = process.argv[3] ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const refreshUrl = process.argv[4] ?? returnUrl;

  if (!tenantId) {
    console.error("Usage: pnpm billing:onboard <tenantId> [returnUrl] [refreshUrl]");
    process.exitCode = 1;
    return;
  }

  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config).filter((issue) => issue.level === "error");
  if (readiness.length > 0) {
    console.error("Tenant configuration is not ready for billing:");
    for (const issue of readiness) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    console.error(`Tenant ${tenantId} not found.`);
    process.exitCode = 1;
    return;
  }

  const link = await createConnectOnboardingLink({ tenantId, returnUrl, refreshUrl });
  console.log("Stripe Connect onboarding link:");
  console.log(link.url);
  if (link.expiresAt) {
    console.log(`Expires at: ${link.expiresAt.toISOString()}`);
  }
  console.log(`Connect account: ${link.connectAccountId}`);
}

main().catch((error) => {
  console.error("Failed to generate onboarding link", error);
  process.exitCode = 1;
});
