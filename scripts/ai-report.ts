#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getInsightsSummary } from "@/lib/analytics/insights";
import { generateInsightsReport } from "@/lib/analytics/report";

async function main() {
  const range = Number.parseInt(process.argv[2] ?? "30", 10) || 30;
  console.log(`🧾 Generating AI insights report for last ${range} days…`);

  const summary = await getInsightsSummary(range);
  const markdown = await generateInsightsReport(summary, { timeframe: `${range}-day` });

  const outputDir = path.resolve(process.cwd(), ".reports");
  const filename = `insights-${summary.range.end}.md`;
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, filename), markdown, "utf8");

  console.log(`Report saved to ${path.join(outputDir, filename)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
