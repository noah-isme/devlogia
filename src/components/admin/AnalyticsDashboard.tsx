"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const chartColor = "var(--chart-1, #6366f1)";

import type { AnalyticsSnapshot } from "@/lib/analytics";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

type FetchState = {
  data: AnalyticsSnapshot | null;
  status: "idle" | "loading" | "error" | "ready";
  error?: string;
};

export function AnalyticsDashboard() {
  const [state, setState] = useState<FetchState>({ data: null, status: "idle" });

  useEffect(() => {
    let isMounted = true;

    async function fetchAnalytics() {
      setState((prev) => ({ ...prev, status: "loading" }));
      try {
        const response = await fetch("/api/analytics", { cache: "no-store" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = typeof body.error === "string" ? body.error : "Unable to load analytics.";
          throw new Error(message);
        }
        const payload = (await response.json()) as AnalyticsSnapshot;
        if (!isMounted) return;
        setState({ data: payload, status: "ready" });
      } catch (error) {
        if (!isMounted) return;
        setState({ data: null, status: "error", error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    fetchAnalytics();
    const id = setInterval(fetchAnalytics, 30_000);

    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  const metrics = useMemo(() => {
    if (!state.data) return [] as Array<{ label: string; value: number; description: string; id: string }>;
    return [
      { id: "posts", label: "Total posts", value: state.data.posts.total, description: `${state.data.posts.published} published` },
      { id: "drafts", label: "Drafts", value: state.data.posts.draft, description: `${state.data.posts.scheduled} scheduled` },
      { id: "views", label: "Lifetime views", value: state.data.posts.views, description: state.data.traffic.timeframe },
      { id: "users", label: "Active users", value: state.data.users.active, description: `${state.data.users.total} total` },
      { id: "pages", label: "Published pages", value: state.data.pages.published, description: `${state.data.pages.total} total` },
      { id: "tags", label: "Tags", value: state.data.tags.total, description: `${state.data.tags.top.length} trending` },
    ];
  }, [state.data]);

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert" data-testid="analytics-error">
        <p className="font-semibold">Analytics unavailable</p>
        <p>{state.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="analytics-dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid={`metric-${metric.id}`}>
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(metric.value)}</p>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </div>
        ))}
        {state.status === "loading" && metrics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4" data-testid="analytics-loading">
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          </div>
        ) : null}
      </div>

      {state.data ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="analytics-chart">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Views over time</h2>
              <p className="text-sm text-muted-foreground">{state.data.traffic.timeframe} of view trends</p>
            </div>
            <div className="text-xs text-muted-foreground">Updated {new Date(state.data.generatedAt).toLocaleTimeString()}</div>
          </header>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <AreaChart data={state.data.traffic.points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={formatNumber} width={80} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [formatNumber(value), "Views"]}
                />
                <Area type="monotone" dataKey="views" stroke={chartColor} fill="url(#colorViews)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {state.data && state.data.tags.top.length ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="analytics-tags">
          <h2 className="text-base font-semibold">Top tags</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.data.tags.top.map((tag) => (
              <li key={tag.name} className="flex items-center justify-between rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{tag.name}</span>
                <span className="text-muted-foreground">{formatNumber(tag.count)} posts</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
