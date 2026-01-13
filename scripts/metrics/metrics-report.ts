export {};

const DEFAULT_ENDPOINT = process.env.METRICS_ENDPOINT ?? "http://localhost:3000/api/metrics";
const METRICS_API_KEY = process.env.METRICS_API_KEY ?? "";

async function fetchSnapshot(endpoint: string) {
  const response = await fetch(endpoint, {
    headers: METRICS_API_KEY ? { "x-metrics-key": METRICS_API_KEY } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as {
    generatedAt: string;
    uptimeSeconds: number;
    totalRequests: number;
    requestsPerSecond: number;
    requestsPerMinute: number;
    errorRate: number;
    cache: { hits: number; misses: number; ratio: number | null };
    latency: { p50: number | null; p95: number | null; p99: number | null };
  };
}

function formatNumber(value: number, fractionDigits = 2) {
  return value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

async function main() {
  const endpoint = process.argv[2] ?? DEFAULT_ENDPOINT;
  const snapshot = await fetchSnapshot(endpoint);

  console.log(`Metrics report from ${endpoint}`);
  console.log(`Generated: ${snapshot.generatedAt}`);
  console.log(`Uptime: ${snapshot.uptimeSeconds}s, total requests: ${snapshot.totalRequests}`);
  console.log(`Request rate: ${formatNumber(snapshot.requestsPerSecond)} rps (${formatNumber(snapshot.requestsPerMinute)} rpm)`);
  console.log(`Error rate: ${(snapshot.errorRate * 100).toFixed(2)}%`);
  const ratio = snapshot.cache.ratio != null ? `${(snapshot.cache.ratio * 100).toFixed(1)}%` : "n/a";
  console.log(`Cache hits: ${snapshot.cache.hits}, misses: ${snapshot.cache.misses}, ratio: ${ratio}`);
  console.log(
    `Latency p50/p95/p99: ${snapshot.latency.p50 ?? "n/a"}/${snapshot.latency.p95 ?? "n/a"}/${snapshot.latency.p99 ?? "n/a"} ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
