import { afterEach, describe, expect, it } from "vitest";

import {
  getAdvancedMetricsSnapshot,
  recordEtlRun,
  recordSdkLatency,
  recordSignatureVerification,
  resetAdvancedMetrics,
} from "@/lib/metrics/advanced";

describe("advanced metrics", () => {
  afterEach(() => {
    resetAdvancedMetrics();
  });

  it("tracks SDK latency percentiles", () => {
    for (let index = 0; index < 10; index += 1) {
      recordSdkLatency(100 + index * 10);
    }

    const snapshot = getAdvancedMetricsSnapshot();
    expect(snapshot.sdk_latency_ms.p50).toBeGreaterThanOrEqual(140);
    expect(snapshot.sdk_latency_ms.p95).toBeGreaterThanOrEqual(180);
  });

  it("tracks signature failure rate", () => {
    recordSignatureVerification({ success: true });
    recordSignatureVerification({ success: false });
    const snapshot = getAdvancedMetricsSnapshot();
    expect(snapshot.signature_fail_rate).toBeCloseTo(0.5, 2);
  });

  it("tracks ETL success rate", () => {
    recordEtlRun({ success: true, durationMs: 1000 });
    recordEtlRun({ success: true, durationMs: 1500 });
    recordEtlRun({ success: false, durationMs: 500 });

    const snapshot = getAdvancedMetricsSnapshot();
    expect(snapshot.etl_success_rate).toBeCloseTo(2 / 3, 2);
    expect(snapshot.etl_duration_avg).toBeGreaterThan(0);
  });
});
