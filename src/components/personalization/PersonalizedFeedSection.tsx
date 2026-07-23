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

export function PersonalizedFeedSection({
  title = "Recommended for you",
  contextPostId,
}: PersonalizedFeedSectionProps) {
  const [state, setState] = useState<FeedState>({
    loading: true,
    error: null,
    items: [],
    fallback: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const params = new URLSearchParams();
      if (contextPostId) params.set("postId", contextPostId);
      const response = await fetch(`/api/feed/personal?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (!cancelled)
          setState({
            loading: false,
            error: "Unable to load personalized feed",
            items: [],
            fallback: false,
          });
        return;
      }
      const data = (await response.json()) as {
        items: PersonalizedFeedItem[];
        segment?: string;
        fallback: boolean;
      };
      if (!cancelled) {
        setState({
          loading: false,
          error: null,
          items: data.items,
          segment: data.segment,
          fallback: data.fallback,
        });
      }
    }
    load().catch((error) => {
      if (!cancelled) {
        setState({
          loading: false,
          error: String(error),
          items: [],
          fallback: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [contextPostId]);

  if (state.loading) {
    return (
      <section className="premium-surface rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Personalized reading
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Curating ideas around your interests…
        </p>
      </section>
    );
  }

  if (state.error || state.items.length === 0) {
    return (
      <section className="premium-surface rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Personalized reading
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.error
            ? state.error
            : "We don’t have enough data to personalize recommendations yet."}
        </p>
      </section>
    );
  }

  return (
    <section className="premium-surface rounded-3xl p-6 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Personalized reading
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            {title}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {state.segment
              ? `Segment: ${state.segment}`
              : "Personalized recommendations"}
            {state.fallback ? " · blended with trending" : ""}
          </p>
        </div>
      </header>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {state.items.map((item) => (
          <li
            key={item.id}
            className="group rounded-2xl border border-border/60 bg-background/70 p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-foreground/5"
          >
            <a
              href={`/blog/${item.slug}`}
              className="text-base font-semibold leading-6 tracking-[-0.015em] transition group-hover:text-primary group-hover:no-underline"
            >
              {item.title}
            </a>
            {item.summary ? (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
            ) : null}
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>
                {state.fallback || item.reason.includes("Trending")
                  ? `Trending ${item.tags?.length ? `· #${item.tags[0]}` : ""}`
                  : `Match ${(item.score * 100).toFixed(0)}% · ${item.reason.slice(0, 2).join(" · ")}`}
              </span>
              <span className="text-[10px] font-semibold text-primary">Read →</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
