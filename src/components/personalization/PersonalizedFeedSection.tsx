"use client";

import { useEffect, useState } from "react";

import type { PersonalizedFeedItem } from "@/lib/personalization/types";

type PersonalizedFeedSectionProps = {
  title?: string;
  contextPostId?: string;
};

type FeedState = {
  loading: boolean;
  error: string | null;
  items: PersonalizedFeedItem[];
  segment?: string;
  fallback: boolean;
};

export function PersonalizedFeedSection({ title = "Recommended for you", contextPostId }: PersonalizedFeedSectionProps) {
  const [state, setState] = useState<FeedState>({ loading: true, error: null, items: [], fallback: false });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const params = new URLSearchParams();
      if (contextPostId) params.set("postId", contextPostId);
      const response = await fetch(`/api/feed/personal?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        if (!cancelled) setState({ loading: false, error: "Unable to load personalized feed", items: [], fallback: false });
        return;
      }
      const data = (await response.json()) as {
        items: PersonalizedFeedItem[];
        segment?: string;
        fallback: boolean;
      };
      if (!cancelled) {
        setState({ loading: false, error: null, items: data.items, segment: data.segment, fallback: data.fallback });
      }
    }
    load().catch((error) => {
      if (!cancelled) {
        setState({ loading: false, error: String(error), items: [], fallback: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [contextPostId]);

  if (state.loading) {
    return (
      <section className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Personalizing your feed…</p>
      </section>
    );
  }

  if (state.error || state.items.length === 0) {
    return (
      <section className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.error ? state.error : "We don’t have enough data to personalize recommendations yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {state.segment ? `Segment: ${state.segment}` : "Personalized recommendations"}
            {state.fallback ? " · blended with trending" : ""}
          </p>
        </div>
      </header>
      <ul className="space-y-3">
        {state.items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border/50 bg-background/70 p-3 shadow-sm">
            <a href={`/blog/${item.slug}`} className="text-sm font-semibold hover:underline">
              {item.title}
            </a>
            {item.summary ? <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Score {(item.score * 100).toFixed(0)}% · {item.reason.slice(0, 2).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
