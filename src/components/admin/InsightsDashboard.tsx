"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { InsightsSummary } from "@/lib/analytics/insights";

const chartColorSessions = "var(--chart-1, #6366f1)";
const chartColorSentiment = "var(--chart-2, #22c55e)";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (!remainder) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainder}s`;
}

type FetchState = {
  status: "idle" | "loading" | "ready" | "error";
  data: InsightsSummary | null;
  error?: string;
};

type InsightsDashboardProps = {
  range?: number;
};

export function InsightsDashboard({ range = 30 }: InsightsDashboardProps) {
  const [state, setState] = useState<FetchState>({ status: "idle", data: null });
  const [isPending, startTransition] = useTransition();

  const loadSummary = useCallback(async () => {
    const response = await fetch(`/api/insights/summary?range=${range}`, { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = typeof payload.error === "string" ? payload.error : "Unable to load insights";
      throw new Error(message);
    }
    return (await response.json()) as InsightsSummary;
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState((prev) => ({ ...prev, status: "loading" }));
      try {
        const summary = await loadSummary();
        if (!cancelled) {
          setState({ status: "ready", data: summary });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", data: null, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
    };

    void run();
    const id = setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadSummary]);

  const metrics = useMemo(() => {
    if (!state.data) return [] as Array<{ id: string; label: string; value: string; description: string }>;
    const ctr = state.data.totals.views ? state.data.totals.shares / state.data.totals.views : 0;
    return [
      {
        id: "sessions",
        label: "Sessions",
        value: numberFormatter.format(state.data.totals.sessions),
        description: `${state.data.range.days}-day window`,
      },
      {
        id: "views",
        label: "Views",
        value: numberFormatter.format(state.data.totals.views),
        description: `${state.data.totals.shares} shares`,
      },
      {
        id: "ctr",
        label: "Share-through",
        value: percentFormatter.format(ctr),
        description: "Shares / Views",
      },
      {
        id: "readTime",
        label: "Avg read time",
        value: formatSeconds(state.data.totals.avgReadTimeSeconds),
        description: `Bounce ${percentFormatter.format(state.data.totals.bounceRate)}`,
      },
      {
        id: "scroll",
        label: "Avg scroll depth",
        value: percentFormatter.format(state.data.totals.avgScrollDepth / 100),
        description: "Scroll engagement",
      },
      {
        id: "sentiment",
        label: "Sentiment",
        value: percentFormatter.format((state.data.totals.sentimentScore + 1) / 2),
        description: `${state.data.feedback.positive} positive, ${state.data.feedback.negative} negative feedback`,
      },
    ];
  }, [state.data]);

  const chartData = useMemo(() => {
    if (!state.data) return [] as Array<{ date: string; sessions: number; sentiment: number }>;
    return state.data.daily.map((day) => ({
      date: day.date,
      sessions: day.sessionCount,
      sentiment: Math.round(day.sentiment.score * 100),
    }));
  }, [state.data]);

  const highlights = state.data?.feedback.highlights ?? [];
  const topPages = state.data?.topPages ?? [];

  return (
    <div className="space-y-8" data-testid="insights-dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </div>
        ))}
        {state.status === "loading" && metrics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading reader insights…
          </div>
        ) : null}
        {state.status === "error" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Insights unavailable</p>
            <p>{state.error}</p>
          </div>
        ) : null}
      </div>

      {chartData.length ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Engagement trend</h2>
              <p className="text-xs text-muted-foreground">Sessions and sentiment across {state.data?.range.days ?? range} days</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
              onClick={() =>
                startTransition(async () => {
                  try {
                    setState((prev) => ({ ...prev, status: "loading" }));
                    const summary = await loadSummary();
                    setState({ status: "ready", data: summary });
                  } catch (error) {
                    setState({
                      status: "error",
                      data: null,
                      error: error instanceof Error ? error.message : "Unknown error",
                    });
                  }
                })
              }
              disabled={isPending}
            >
              Refresh
            </button>
          </header>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColorSessions} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={chartColorSessions} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColorSentiment} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={chartColorSentiment} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => numberFormatter.format(value)} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) =>
                    name === "sentiment" ? [`${value}%`, "Sentiment"] : [numberFormatter.format(value), "Sessions"]
                  }
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke={chartColorSessions}
                  fill="url(#sessionsGradient)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="sentiment"
                  name="Sentiment"
                  stroke={chartColorSentiment}
                  fill="url(#sentimentGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {topPages.length ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Top pages</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Page</th>
                <th className="py-2">Sessions</th>
                <th className="py-2">Views</th>
                <th className="py-2">Avg read</th>
                <th className="py-2">Scroll</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((page) => (
                <tr key={page.page} className="border-t border-border/50">
                  <td className="py-2 font-medium">{page.page}</td>
                  <td className="py-2">{numberFormatter.format(page.sessions)}</td>
                  <td className="py-2">{numberFormatter.format(page.views)}</td>
                  <td className="py-2">{formatSeconds(page.avgReadTimeSeconds)}</td>
                  <td className="py-2">{percentFormatter.format(page.avgScrollDepth / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {highlights.length ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Reader feedback highlights</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {highlights.map((entry) => (
              <li key={`${entry.createdAt}-${entry.message.slice(0, 12)}`} className="rounded-lg border border-border/60 bg-muted/40 p-3">
                <p className="font-medium">{entry.page ?? "General"}</p>
                <p className="mt-1 text-muted-foreground">{entry.message}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Sentiment: {entry.sentiment.label}</span>
                  <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
