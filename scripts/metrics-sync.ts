import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_ENDPOINT = process.env.METRICS_ENDPOINT ?? "http://localhost:3000/api/metrics";
const METRICS_API_KEY = process.env.METRICS_API_KEY ?? "";
const ERROR_RATE_THRESHOLD = Number(process.env.METRICS_ERROR_RATE_THRESHOLD ?? 0.01);
const P95_THRESHOLD = Number(process.env.METRICS_P95_THRESHOLD_MS ?? 800);
const OUTPUT_DIR = process.env.METRICS_OUTPUT_DIR ?? ".reports";

async function fetchSnapshot(endpoint: string) {
  const response = await fetch(endpoint, {
    headers: METRICS_API_KEY ? { "x-metrics-key": METRICS_API_KEY } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as {
    generatedAt: string;
    requestsPerSecond: number;
    errorRate: number;
    latency: { p95: number | null };
  };
}

async function sendSlackAlert(message: string) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

async function sendTelegramAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
  });
}

function buildAlertMessage(endpoint: string, snapshot: Awaited<ReturnType<typeof fetchSnapshot>>, triggers: string[]) {
  const lines = [
    `:rotating_light: *Devlogia metrics alert*`,
    `Endpoint: ${endpoint}`,
    `Generated: ${snapshot.generatedAt}`,
    `Requests/sec: ${snapshot.requestsPerSecond.toFixed(2)}`,
    `Error rate: ${(snapshot.errorRate * 100).toFixed(2)}%`,
    `Latency p95: ${snapshot.latency.p95 ?? "n/a"} ms`,
    `Triggers: ${triggers.join(", ")}`,
  ];

  return lines.join("\n");
}

async function main() {
  const endpoint = process.argv[2] ?? DEFAULT_ENDPOINT;
  const snapshot = await fetchSnapshot(endpoint);
  const alerts: string[] = [];

  if (snapshot.errorRate > ERROR_RATE_THRESHOLD) {
    alerts.push(`error-rate>${(ERROR_RATE_THRESHOLD * 100).toFixed(2)}%`);
  }

  if ((snapshot.latency.p95 ?? 0) > P95_THRESHOLD) {
    alerts.push(`p95>${P95_THRESHOLD}ms`);
  }

  const outputPath = resolve(process.cwd(), OUTPUT_DIR, "metrics-latest.json");
  await mkdir(resolve(process.cwd(), OUTPUT_DIR), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved metrics snapshot to ${outputPath}`);

  if (alerts.length) {
    const message = buildAlertMessage(endpoint, snapshot, alerts);
    await Promise.allSettled([sendSlackAlert(message), sendTelegramAlert(message)]);
    console.warn(`Alerts triggered: ${alerts.join(", ")}`);
    process.exitCode = 2;
  } else {
    console.log("No alert thresholds exceeded");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
