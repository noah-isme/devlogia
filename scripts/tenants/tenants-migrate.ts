import { createTenantConfig, evaluateTenantReadiness } from "../../src/lib/tenant";

async function main() {
  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const errors = readiness.filter((issue) => issue.level === "error");

  console.log("🔄 Tenant migration preflight");
  console.log(` • Mode: ${config.mode}`);
  console.log(` • Default plan: ${config.defaultPlan}`);
  console.log(` • Billing provider: ${config.billing.provider}`);

  if (errors.length > 0) {
    console.error("❌ Blocking issues detected; aborting tenant migration scaffold.");
    for (const issue of errors) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const warnings = readiness.filter((issue) => issue.level === "warning");
  if (warnings.length > 0) {
    console.warn("⚠️  Tenant readiness warnings:");
    for (const issue of warnings) {
      console.warn(` • [${issue.code}] ${issue.message}`);
    }
  }

  console.log("✅ Tenant configuration looks healthy for multi-tenant migrations.");
}

main().catch((error) => {
  console.error("Tenant migration preflight failed", error);
  process.exitCode = 1;
});
