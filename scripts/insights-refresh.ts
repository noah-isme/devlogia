#!/usr/bin/env tsx
import process from "node:process";

import { runInsightEtl } from "@/lib/personalization/etl";
import { getCreatorInsightSnapshot } from "@/lib/personalization/insights";

async function main() {
  console.log("⚙️ Refreshing personalization insights…");
  const etlStart = Date.now();
  const etlResult = await runInsightEtl({ refreshAffinities: true });
  const etlDuration = Date.now() - etlStart;
  console.log(
    `ETL complete in ${etlDuration}ms — profiles=${etlResult.profiles} vectors=${etlResult.contentVectors} affinities=${etlResult.affinities} errors=${etlResult.errors}`,
  );

  if (etlResult.errors > 0) {
    console.error(`Detected ${etlResult.errors} ETL errors`);
  }

  const snapshot = await getCreatorInsightSnapshot(20);
  console.log(`Predictions refreshed (${snapshot.posts.length} posts)`);
  for (const post of snapshot.posts.slice(0, 5)) {
    console.log(
      `• ${post.title} — CTR ${(post.predictedCtr * 100).toFixed(1)}% | dwell ${post.predictedDwellSeconds}s | engagement ${(post.predictedEngagementProbability * 100).toFixed(1)}%`,
    );
  }

  if (etlResult.errors / Math.max(1, etlResult.profiles) > 0.005) {
    console.error("⚠️ ETL error rate exceeded 0.5% threshold");
    process.exitCode = 1;
  }

  if (etlDuration > 5 * 60 * 1000) {
    console.error("⚠️ ETL runtime exceeded 5 minutes");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("insights:refresh failed", error);
  process.exitCode = 1;
});
