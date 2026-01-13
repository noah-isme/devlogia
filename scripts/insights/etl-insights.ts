#!/usr/bin/env tsx
import process from "node:process";

import { runInsightEtl } from "@/lib/personalization/etl";

async function main() {
  console.log("🧩 Running unified analytics ETL…");
  const result = await runInsightEtl();
  console.log(
    `Profiles: ${result.profiles}, content vectors: ${result.contentVectors}, affinities: ${result.affinities}, duration: ${result.durationMs}ms, errors: ${result.errors}`,
  );
  if (result.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("ETL failed", error);
  process.exitCode = 1;
});
