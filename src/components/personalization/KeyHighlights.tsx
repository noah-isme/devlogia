"use client";

import { useEffect, useState } from "react";

type SummaryPayload = {
  summary: string;
  highlights: string[];
  model: string;
  cached: boolean;
  generatedAt: string;
};

type KeyHighlightsProps = {
  slug: string;
};

type SummaryState = {
  loading: boolean;
  error: string | null;
  data: SummaryPayload | null;
};

export function KeyHighlights({ slug }: KeyHighlightsProps) {
  const [state, setState] = useState<SummaryState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ loading: true, error: null, data: null });
      const response = await fetch(`/api/summary/${slug}`, { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) setState({ loading: false, error: "Unable to load summary", data: null });
        return;
      }
      const payload = (await response.json()) as SummaryPayload;
      if (!cancelled) setState({ loading: false, error: null, data: payload });
    }
    load().catch((error) => {
      if (!cancelled) setState({ loading: false, error: String(error), data: null });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.loading) {
    return (
      <aside className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key highlights</h2>
        <p className="mt-2 text-sm text-muted-foreground">Generating summary…</p>
      </aside>
    );
  }

  if (state.error || !state.data) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key highlights</h2>
      <p className="mt-2 text-sm text-muted-foreground">{state.data.summary}</p>
      <ul className="mt-3 space-y-2 text-sm text-foreground">
        {state.data.highlights.map((highlight, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Personalized summary · {state.data.cached ? "cached" : "fresh"} · model {state.data.model}
      </p>
    </aside>
  );
}
