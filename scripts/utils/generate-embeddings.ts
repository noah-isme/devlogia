#!/usr/bin/env tsx
import process from "node:process";

import { regenerateEmbeddingsForPosts, rebuildRecommendations } from "@/lib/recommendations";
import { regenerateTopicClusters } from "@/lib/topics";

async function main() {
  console.log("📚 Generating embeddings for published posts…");
  const result = await regenerateEmbeddingsForPosts();
  console.log(`Generated: ${result.generated}, skipped: ${result.skipped}`);

  console.log("🔁 Rebuilding recommendation graph…");
  const { updated } = await rebuildRecommendations();
  console.log(`Updated ${updated} recommendation edges`);

  console.log("🧠 Refreshing topic clusters…");
  const { clusters, posts } = await regenerateTopicClusters();
  console.log(`Clusters: ${clusters}, assignments: ${posts}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
