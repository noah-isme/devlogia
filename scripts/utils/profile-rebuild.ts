#!/usr/bin/env tsx
import process from "node:process";

import { runInsightEtl } from "@/lib/personalization/etl";

async function main() {
  console.log("🔁 Rebuilding user profiles…");
  const result = await runInsightEtl({ refreshAffinities: true, skipAuditLog: true });
  console.log(
    `Rebuilt ${result.profiles} profiles with ${result.affinities} affinities. Duration ${result.durationMs}ms. Errors ${result.errors}`,
  );
  if (result.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("profile:rebuild failed", error);
  process.exitCode = 1;
});
