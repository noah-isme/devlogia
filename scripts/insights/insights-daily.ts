#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getInsightsSummary } from "@/lib/analytics/insights";
import { generateInsightsReport } from "@/lib/analytics/report";
import { markdownToReportBuffer } from "@/lib/pdf";
import { regenerateEmbeddingsForPosts, rebuildRecommendations } from "@/lib/recommendations";
import { regenerateTopicClusters } from "@/lib/topics";
import { uploadBuffer } from "@/lib/storage";

async function sendSlack(message: string) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

async function sendTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

function detectEngagementDrop(summary: Awaited<ReturnType<typeof getInsightsSummary>>) {
  if (summary.daily.length < 2) return null;
  const [previous, current] = summary.daily.slice(-2);
  if (!previous.sessionCount) return null;
  const change = (previous.sessionCount - current.sessionCount) / previous.sessionCount;
  if (change >= 0.2) {
    return {
      change,
      message: `Engagement dropped ${(change * 100).toFixed(1)}% (${previous.sessionCount} -> ${current.sessionCount} sessions).`,
    };
  }
  return null;
}

async function main() {
  console.log("🧠 Running daily insights job…");
  const { generated, skipped } = await regenerateEmbeddingsForPosts();
  console.log(`Embeddings regenerated: ${generated}, skipped: ${skipped}`);

  const { updated } = await rebuildRecommendations();
  console.log(`Recommendations updated: ${updated}`);

  const { clusters, posts } = await regenerateTopicClusters();
  console.log(`Topic clusters updated: ${clusters} clusters covering ${posts} posts`);

  const summary = await getInsightsSummary(30);
  const markdown = await generateInsightsReport(summary, { timeframe: "weekly" });
  const { buffer, contentType } = markdownToReportBuffer(markdown, "markdown");

  const filename = `insights-${summary.range.end}.md`;
  const outputDir = path.resolve(process.cwd(), ".reports");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, filename), buffer);
  console.log(`Report saved locally to ${path.join(outputDir, filename)}`);

  try {
    await uploadBuffer(buffer, `insights/${filename}`, contentType);
    console.log("Report uploaded to storage");
  } catch (error) {
    console.warn("Storage upload failed", error);
  }

  const alert = detectEngagementDrop(summary);
  if (alert) {
    const message = `:warning: Devlogia engagement alert: ${alert.message} Range ${summary.range.start} – ${summary.range.end}`;
    await Promise.allSettled([sendSlack(message), sendTelegram(message)]);
    console.warn(message);
  } else {
    console.log("No engagement anomalies detected");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
