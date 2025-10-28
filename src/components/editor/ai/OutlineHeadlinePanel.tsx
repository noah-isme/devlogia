"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { OutlineResult } from "@/lib/ai/types";

type OutlineHeadlinePanelProps = {
  disabled: boolean;
  postId: string | null;
  title: string;
  summary: string;
  tags: string[];
  onOutline: (mdx: string) => void;
  onHeadline: (headline: string) => void;
};

export function OutlineHeadlinePanel({ disabled, postId, title, summary, tags, onOutline, onHeadline }: OutlineHeadlinePanelProps) {
  const [outline, setOutline] = useState<{ outline: OutlineResult; mdx: string } | null>(null);
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [loadingHeadlines, setLoadingHeadlines] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateOutline() {
    if (disabled || loadingOutline) {
      return;
    }
    setLoadingOutline(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/outline", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, topic: title, summary, tags }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Outline generation failed.");
        setLoadingOutline(false);
        return;
      }
      const data = (await response.json()) as { outline: OutlineResult; mdx: string };
      setOutline({ outline: data.outline, mdx: data.mdx });
    } catch (error) {
      console.error("Outline generation failed", error);
      setError("Unable to generate outline.");
    } finally {
      setLoadingOutline(false);
    }
  }

  async function generateHeadlines() {
    if (disabled || loadingHeadlines) {
      return;
    }
    setLoadingHeadlines(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/headlines", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, baseTitle: title, summary, tags, count: 5 }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Headline generation failed.");
        setLoadingHeadlines(false);
        return;
      }
      const data = (await response.json()) as { variants: string[] };
      setHeadlines(data.variants ?? []);
    } catch (error) {
      console.error("Headline generation failed", error);
      setError("Unable to generate headlines.");
    } finally {
      setLoadingHeadlines(false);
    }
  }

  function applyOutline() {
    if (!outline) {
      return;
    }
    onOutline(outline.mdx);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Outline & headline tools</h2>
        <Badge variant={disabled ? "warning" : "default"}>{disabled ? "Disabled" : "Active"}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Quickly scaffold outlines and headline variants ready for A/B testing.</p>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Outline</h3>
          <Button type="button" size="sm" onClick={generateOutline} disabled={disabled || loadingOutline}>
            {loadingOutline ? "Generating…" : "Generate outline"}
          </Button>
        </div>
        {outline ? (
          <>
            <Textarea value={outline.mdx} readOnly className="min-h-[160px] font-mono text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={applyOutline}>
              Insert outline into draft
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Outline will appear here and can be inserted into the editor.</p>
        )}
      </div>
      <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Headline variants</h3>
          <Button type="button" size="sm" onClick={generateHeadlines} disabled={disabled || loadingHeadlines}>
            {loadingHeadlines ? "Generating…" : "Generate variants"}
          </Button>
        </div>
        {headlines.length ? (
          <ul className="space-y-2">
            {headlines.map((headline) => (
              <li key={headline} className="flex items-center gap-2">
                <span className="flex-1">{headline}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => onHeadline(headline)}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Variants are saved for A/B toggles and can be applied instantly.</p>
        )}
      </div>
    </div>
  );
}
