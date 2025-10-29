import { scheduleFederationPublishing } from "../src/lib/federation/indexer";
import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const blocking = readiness.filter((issue) => issue.level === "error");

  if (blocking.length > 0) {
    console.error("❌ Federation cron aborted due to configuration errors:");
    for (const issue of blocking) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("⏱️  Scheduling federation publishing every 30 minutes");
  scheduleFederationPublishing({ intervalMinutes: 30, tenantSlug: process.env.TENANT_SLUG ?? "default" });
}

main().catch((error) => {
  console.error("Federation cron failed", error);
  process.exitCode = 1;
});
