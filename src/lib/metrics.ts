import { logger } from "@/lib/logger";

const MAX_SAMPLES = 7200; // store up to two hours of per-second samples
const MAX_LATENCY_SAMPLES = 1000;

type CacheStatus = "hit" | "miss" | "bypass" | "unknown";

type MetricsSample = {
  timestamp: number;
  durationMs: number;
  status: number;
  cache: CacheStatus;
};

type MetricsRegistry = {
  startTime: number;
  totalRequests: number;
  totalErrors: number;
  cacheHits: number;
  cacheMisses: number;
  cacheBypasses: number;
  samples: MetricsSample[];
  latencySamples: number[];
  lastUpdated: number;
};

type SnapshotLatency = {
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
};

type SnapshotCache = {
  hits: number;
  misses: number;
  bypasses: number;
  ratio: number | null;
};

type MetricsSnapshot = {
  generatedAt: string;
  uptimeSeconds: number;
  totalRequests: number;
  requestsPerSecond: number;
  requestsPerMinute: number;
  errorRate: number;
  cache: SnapshotCache;
  latency: SnapshotLatency;
};

declare global {
  var __DEVLOGIA_METRICS__: MetricsRegistry | undefined;
}

function ensureRegistry(): MetricsRegistry {
  if (!globalThis.__DEVLOGIA_METRICS__) {
    globalThis.__DEVLOGIA_METRICS__ = {
      startTime: Date.now(),
      totalRequests: 0,
      totalErrors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheBypasses: 0,
      samples: [],
      latencySamples: [],
      lastUpdated: Date.now(),
    } satisfies MetricsRegistry;
  }

  return globalThis.__DEVLOGIA_METRICS__;
}

function classifyCacheStatus(raw: string | null | undefined): CacheStatus {
  if (!raw || typeof raw !== "string") {
    return "unknown";
  }

  try {
    const normalized = raw.trim().toLowerCase();
    if (["hit", "edge", "cached", "hit from cloudfront"].some((token) => normalized.includes(token))) {
      return "hit";
    }
    if (["miss", "fwd", "fetch"].some((token) => normalized.includes(token))) {
      return "miss";
    }
    if (["bypass", "pass"].some((token) => normalized.includes(token))) {
      return "bypass";
    }
  } catch (error) {
    logger.debug({ error, raw }, "Failed to classify cache status");
  }
  return "unknown";
}

function computePercentile(values: number[], percentile: number): number | null {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index];
}

function pruneSamples(registry: MetricsRegistry, now: number) {
  const windowMs = 5 * 60 * 1000;
  registry.samples = registry.samples.filter((sample) => now - sample.timestamp <= windowMs);
  if (registry.samples.length > MAX_SAMPLES) {
    registry.samples.splice(0, registry.samples.length - MAX_SAMPLES);
  }
  if (registry.latencySamples.length > MAX_LATENCY_SAMPLES) {
    registry.latencySamples.splice(0, registry.latencySamples.length - MAX_LATENCY_SAMPLES);
  }
}

export function recordRequestMetrics({
  status,
  durationMs,
  cacheHeader,
}: {
  status: number;
  durationMs: number;
  cacheHeader?: string | null;
}) {
  const registry = ensureRegistry();
  registry.totalRequests += 1;
  registry.lastUpdated = Date.now();

  if (status >= 500) {
    registry.totalErrors += 1;
  }

  if (Number.isFinite(durationMs)) {
    registry.latencySamples.push(Math.max(0, durationMs));
  }

  const cacheStatus = classifyCacheStatus(cacheHeader ?? null);
  if (cacheStatus === "hit") {
    registry.cacheHits += 1;
  } else if (cacheStatus === "miss") {
    registry.cacheMisses += 1;
  } else if (cacheStatus === "bypass") {
    registry.cacheBypasses += 1;
  }

  registry.samples.push({
    timestamp: registry.lastUpdated,
    durationMs: Math.max(0, durationMs),
    status,
    cache: cacheStatus,
  });

  pruneSamples(registry, registry.lastUpdated);
}

export function getMetricsSnapshot(): MetricsSnapshot {
  const registry = ensureRegistry();
  const now = Date.now();
  pruneSamples(registry, now);

  const windowMs = 60 * 1000;
  const recentSamples = registry.samples.filter((sample) => now - sample.timestamp <= windowMs);
  const requestsPerMinute = recentSamples.length * (60_000 / windowMs);
  const requestsPerSecond = recentSamples.length / (windowMs / 1000);
  const totalCacheDecisions = registry.cacheHits + registry.cacheMisses;
  const cacheRatio = totalCacheDecisions > 0 ? registry.cacheHits / totalCacheDecisions : null;
  const errorRate = registry.totalRequests > 0 ? registry.totalErrors / registry.totalRequests : 0;

  const latency: SnapshotLatency = {
    p50: computePercentile(registry.latencySamples, 0.5),
    p90: computePercentile(registry.latencySamples, 0.9),
    p95: computePercentile(registry.latencySamples, 0.95),
    p99: computePercentile(registry.latencySamples, 0.99),
  };

  const uptimeSeconds = Math.max(0, Math.round((now - registry.startTime) / 1000));

  return {
    generatedAt: new Date(now).toISOString(),
    uptimeSeconds,
    totalRequests: registry.totalRequests,
    requestsPerSecond,
    requestsPerMinute,
    errorRate,
    cache: {
      hits: registry.cacheHits,
      misses: registry.cacheMisses,
      bypasses: registry.cacheBypasses,
      ratio: cacheRatio,
    },
    latency,
  } satisfies MetricsSnapshot;
}

export function resetMetricsRegistry() {
  if (process.env.NODE_ENV !== "production") {
    globalThis.__DEVLOGIA_METRICS__ = undefined;
  } else {
    logger.warn("Attempted to reset metrics registry in production environment");
  }
}

export type { MetricsSnapshot };
