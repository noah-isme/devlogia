import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { publishFederationIndex } from "../src/lib/federation/indexer";
import { createTenantConfig, evaluateTenantReadiness } from "../src/lib/tenant";

async function main() {
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "25", 10) : 25;
  const push = process.argv.includes("--push");
  const tenantSlug = process.env.TENANT_SLUG ?? "default";

  const config = createTenantConfig(process.env);
  const readiness = evaluateTenantReadiness(config);
  const blocking = readiness.filter((issue) => issue.level === "error");

  if (blocking.length > 0) {
    console.error("❌ Federation publish aborted due to configuration errors:");
    for (const issue of blocking) {
      console.error(` • [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!push || !config.federation.indexUrl || !config.federation.apiKey) {
    const { payload, durationMs } = await publishFederationIndex({ limit, tenantSlug, push: false });
    const outputDir = resolve(process.cwd(), ".reports");
    await mkdir(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "federation-payload.json");
    await writeFile(outputPath, JSON.stringify(payload, null, 2));
    console.log(`📝 Federation payload written to ${outputPath} in ${durationMs.toFixed(1)}ms`);
    if (push) {
      console.warn(
        "⚠️  Federation push requested but missing FEDERATION_INDEX_URL or FEDERATION_API_KEY. Payload saved locally instead.",
      );
    }
    return;
  }

  try {
    const result = await publishFederationIndex({ limit, tenantSlug, push: true });
    console.log(
      `🚀 Federation payload published successfully. ${result.payload.items.length} items in ${result.durationMs.toFixed(1)}ms`,
    );
  } catch (error) {
    console.error("❌ Federation publish failed", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Federation publish failed", error);
  process.exitCode = 1;
});
