type SuccessWindow = { successes: number; failures: number; durations: number[] };

type AdvancedRegistry = {
  sdkLatency: number[];
  signatureFailures: number;
  signatureChecks: number;
  etlRuns: SuccessWindow;
};

declare global {
  var __DEVLOGIA_ADV_METRICS__: AdvancedRegistry | undefined;
}

function ensureRegistry(): AdvancedRegistry {
  if (!globalThis.__DEVLOGIA_ADV_METRICS__) {
    globalThis.__DEVLOGIA_ADV_METRICS__ = {
      sdkLatency: [],
      signatureFailures: 0,
      signatureChecks: 0,
      etlRuns: { successes: 0, failures: 0, durations: [] },
    } satisfies AdvancedRegistry;
  }

  return globalThis.__DEVLOGIA_ADV_METRICS__;
}

export function recordSdkLatency(durationMs: number) {
  const registry = ensureRegistry();
  if (!Number.isFinite(durationMs)) {
    return;
  }
  registry.sdkLatency.push(Math.max(0, durationMs));
  if (registry.sdkLatency.length > 5000) {
    registry.sdkLatency.splice(0, registry.sdkLatency.length - 5000);
  }
}

export function recordSignatureVerification({ success }: { success: boolean }) {
  const registry = ensureRegistry();
  registry.signatureChecks += 1;
  if (!success) {
    registry.signatureFailures += 1;
  }
}

export function recordEtlRun({ success, durationMs }: { success: boolean; durationMs?: number }) {
  const registry = ensureRegistry();
  if (success) {
    registry.etlRuns.successes += 1;
  } else {
    registry.etlRuns.failures += 1;
  }
  if (Number.isFinite(durationMs)) {
    registry.etlRuns.durations.push(Math.max(0, durationMs ?? 0));
    if (registry.etlRuns.durations.length > 200) {
      registry.etlRuns.durations.splice(0, registry.etlRuns.durations.length - 200);
    }
  }
}

export function getAdvancedMetricsSnapshot() {
  const registry = ensureRegistry();
  const totalChecks = registry.signatureChecks || 1;
  const totalRuns = registry.etlRuns.successes + registry.etlRuns.failures || 1;
  const latencies = [...registry.sdkLatency].sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (!latencies.length) {
      return null;
    }
    const index = Math.min(latencies.length - 1, Math.floor(p * latencies.length));
    return latencies[index];
  };

  return {
    sdk_latency_ms: {
      p50: percentile(0.5),
      p90: percentile(0.9),
      p95: percentile(0.95),
    },
    signature_fail_rate: registry.signatureFailures / totalChecks,
    etl_success_rate: registry.etlRuns.successes / totalRuns,
    etl_duration_avg: registry.etlRuns.durations.length
      ? registry.etlRuns.durations.reduce((acc, value) => acc + value, 0) / registry.etlRuns.durations.length
      : null,
  };
}

export function resetAdvancedMetrics() {
  if (process.env.NODE_ENV !== "production") {
    globalThis.__DEVLOGIA_ADV_METRICS__ = undefined;
  }
}
