import { prisma } from "../src/lib/prisma";
import { syncTenantPlanQuota } from "../src/lib/billing/quota";
import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config).filter((issue) => issue.level === "error");
  if (readiness.length > 0) {
    console.error("Tenant configuration not ready for billing:");
    for (const issue of readiness) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, plan: true } });
  for (const tenant of tenants) {
    await syncTenantPlanQuota(tenant.id, tenant.plan as "free" | "pro" | "enterprise");
    console.log(`✅ Synced quotas for tenant ${tenant.id} (${tenant.plan})`);
  }
}

main().catch((error) => {
  console.error("Failed to synchronize plan quotas", error);
  process.exitCode = 1;
});
