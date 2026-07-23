"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ReactionType = "clap" | "heart" | "fire" | "rocket" | "thinking";

type ReactionCounts = Record<ReactionType, number>;

const REACTION_CONFIG: Array<{ type: ReactionType; emoji: string; label: string }> = [
  { type: "clap", emoji: "👏", label: "Clap" },
  { type: "heart", emoji: "❤️", label: "Love" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "rocket", emoji: "🚀", label: "Rocket" },
  { type: "thinking", emoji: "💡", label: "Insightful" },
];

type PostReactionsProps = {
  readonly postId: string;
};

export function PostReactions({ postId }: PostReactionsProps) {
  const [counts, setCounts] = useState<ReactionCounts>({
    clap: 0,
    heart: 0,
    fire: 0,
    rocket: 0,
    thinking: 0,
  });
  const [userClicks, setUserClicks] = useState<Record<ReactionType, number>>({
    clap: 0,
    heart: 0,
    fire: 0,
    rocket: 0,
    thinking: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadReactions() {
      try {
        const response = await fetch(`/api/posts/${postId}/reactions`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted && data.reactions) {
            setCounts(data.reactions);
          }
        }
      } catch (error) {
        console.error("Failed to load post reactions", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReactions();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  async function handleReact(type: ReactionType) {
    if (userClicks[type] >= 10) {
      toast.info("Maximum reactions reached for this post!");
      return;
    }

    // Optimistic UI update
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    setUserClicks((prev) => ({ ...prev, [type]: prev[type] + 1 }));

    try {
      const response = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: 1 }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reactions) {
          setCounts(data.reactions);
        }
      }
    } catch (error) {
      console.error("Failed to send reaction", error);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <section aria-label="Post Reactions" className="my-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Enjoyed this article?</h3>
          <p className="text-xs text-muted-foreground">Give it a clap or reaction to show your feedback.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {REACTION_CONFIG.map(({ type, emoji, label }) => {
            const currentCount = counts[type] ?? 0;
            const clicked = userClicks[type] > 0;
            return (
              <Button
                key={type}
                type="button"
                variant={clicked ? "default" : "outline"}
                size="sm"
                className={`h-9 rounded-full px-3 text-xs transition-transform active:scale-95 ${
                  clicked ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
                }`}
                onClick={() => void handleReact(type)}
              >
                <span className="mr-1.5 text-sm">{emoji}</span>
                <span>{label}</span>
                {currentCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-bold">
                    {currentCount}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
