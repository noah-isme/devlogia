import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { getMetricsSnapshot, recordRequestMetrics, resetMetricsRegistry } from "@/lib/metrics";

describe("metrics registry", () => {
  beforeEach(() => {
    resetMetricsRegistry();
  });

  it("records requests and computes cache ratio", () => {
    recordRequestMetrics({ status: 200, durationMs: 120, cacheHeader: "HIT" });
    recordRequestMetrics({ status: 500, durationMs: 240, cacheHeader: "MISS" });
    recordRequestMetrics({ status: 200, durationMs: 60, cacheHeader: "BYPASS" });

    const snapshot = getMetricsSnapshot();
    expect(snapshot.totalRequests).toBe(3);
    expect(snapshot.errorRate).toBeCloseTo(1 / 3);
    expect(snapshot.cache.hits).toBe(1);
    expect(snapshot.cache.misses).toBe(1);
    expect(snapshot.cache.bypasses).toBe(1);
    expect(snapshot.cache.ratio).toBeCloseTo(0.5);
  });

  it("computes latency percentiles", () => {
    for (let index = 0; index < 100; index += 1) {
      recordRequestMetrics({ status: 200, durationMs: index, cacheHeader: "MISS" });
    }

    const snapshot = getMetricsSnapshot();
    expect(snapshot.latency.p50).toBeDefined();
    expect(snapshot.latency.p95).toBeGreaterThanOrEqual(snapshot.latency.p50 ?? 0);
    expect(snapshot.latency.p99).toBeGreaterThanOrEqual(snapshot.latency.p95 ?? 0);
  });
});
