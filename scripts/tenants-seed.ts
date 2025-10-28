import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const errors = readiness.filter((issue) => issue.level === "error");

  if (errors.length > 0) {
    console.error("❌ Tenant configuration is not ready for seeding:");
    for (const issue of errors) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const summary = {
    mode: config.mode,
    defaultPlan: config.defaultPlan,
    adminEmail: config.adminEmail,
    billingProvider: config.billing.provider,
    federationIndexUrl: config.federation.indexUrl,
    generatedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  const outputDir = resolve(process.cwd(), ".reports");
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "tenant-bootstrap.json");
  await writeFile(outputPath, JSON.stringify(summary, null, 2));

  console.log(`✅ Wrote tenant bootstrap summary to ${outputPath}`);

  const warnings = readiness.filter((issue) => issue.level === "warning");
  if (warnings.length > 0) {
    console.warn("⚠️  Non-blocking tenant readiness warnings:");
    for (const issue of warnings) {
      console.warn(` • [${issue.code}] ${issue.message}`);
    }
  }
}

main().catch((error) => {
  console.error("Failed to produce tenant bootstrap manifest", error);
  process.exitCode = 1;
});
