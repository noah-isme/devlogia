"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FederationItem = {
  postId: string;
  slug: string;
  tenantSlug: string;
  score: number;
  title: string;
  summary?: string | null;
  tags?: string[];
};

type FederationResponse = {
  items: FederationItem[];
  latencyMs: number;
  cache: "hit" | "miss";
  fallback?: boolean;
};

type DashboardState = {
  data: FederationResponse | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: DashboardState = { data: null, loading: true, error: null };

async function fetchFederation(limit: number): Promise<FederationResponse> {
  const response = await fetch("/api/federation/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

function formatLatency(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) {
    return "—";
  }
  return `${Math.round(value ?? 0)} ms`;
}

function aggregateByTenant(items: FederationItem[]) {
  const map = new Map<string, { tenant: string; count: number; avgScore: number; tags: Set<string> }>();

  for (const item of items) {
    const entry = map.get(item.tenantSlug) ?? {
      tenant: item.tenantSlug,
      count: 0,
      avgScore: 0,
      tags: new Set<string>(),
    };
    entry.count += 1;
    entry.avgScore += item.score;
    item.tags?.forEach((tag) => entry.tags.add(tag));
    map.set(item.tenantSlug, entry);
  }

  return Array.from(map.values()).map((entry) => ({
    tenant: entry.tenant,
    count: entry.count,
    avgScore: entry.count > 0 ? entry.avgScore / entry.count : 0,
    tags: Array.from(entry.tags).slice(0, 6),
  }));
}

export function FederationDashboard() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [limit, setLimit] = useState<number>(12);

  const refresh = useCallback(async (nextLimit: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFederation(nextLimit);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async (value: number) => {
      if (cancelled) return;
      await refresh(value);
    };

    void run(limit);
    const interval = setInterval(() => {
      void run(limit);
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [limit, refresh]);

  const tenantRows = useMemo(() => {
    if (!state.data) {
      return [];
    }
    return aggregateByTenant(state.data.items)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [state.data]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Global feed</p>
          <h2 className="text-xl font-semibold text-foreground">Federated recommendations</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="federation-limit" className="sr-only">
            Result limit
          </label>
          <select
            id="federation-limit"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            value={limit}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              setLimit(value);
              void refresh(value);
            }}
          >
            {[12, 24, 36].map((value) => (
              <option key={value} value={value}>
                Last {value} items
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-background/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => refresh(limit)}
            disabled={state.loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Latency</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatLatency(state.data?.latencyMs)}</p>
          <p className="text-xs text-muted-foreground">Time to resolve latest cross-tenant recommendations.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Items</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{state.data?.items.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">Results returned from the global federation index.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cache</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{state.data?.cache ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Indicates whether the query hit the edge cache.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fallback</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{state.data?.fallback ? "Active" : "Idle"}</p>
          <p className="text-xs text-muted-foreground">Automatic failover when the federation service is unavailable.</p>
        </div>
      </div>

      {state.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-sm font-medium">Federation data unavailable</p>
          <p className="text-xs text-red-800/80">{state.error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 shadow-sm">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Tenant
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Items
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Avg. score
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-background/60">
            {tenantRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {state.loading ? "Loading federation telemetry…" : "No federated recommendations available yet."}
                </td>
              </tr>
            ) : (
              tenantRows.map((row) => (
                <tr key={row.tenant}>
                  <td className="px-4 py-3 font-medium">{row.tenant}</td>
                  <td className="px-4 py-3">{row.count}</td>
                  <td className="px-4 py-3">{row.avgScore.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {row.tags.length === 0 && <span>—</span>}
                      {row.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2 py-1">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        <p>
          Data refreshes every 60 seconds. Latency targets remain under <strong>700 ms</strong> for cross-tenant queries to
          ensure a responsive global feed.
        </p>
      </div>
    </section>
  );
}
