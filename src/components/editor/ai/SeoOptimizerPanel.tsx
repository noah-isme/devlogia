"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import type { SeoSuggestion } from "@/lib/ai/types";

type SeoOptimizerPanelProps = {
  disabled: boolean;
  postId: string | null;
  title: string;
  summary: string;
  slug: string;
  content: string;
  onApply: (payload: { title: string; summary: string; slug: string }) => void;
  onKeywords: (keywords: string[], faqs: string[]) => void;
};

type SeoResponse = SeoSuggestion & {
  validation?: { slugAvailable: boolean; conflictingTitles: Array<{ id: string; title: string; similarity: number }> };
};

export function SeoOptimizerPanel({ disabled, postId, title, summary, slug, content, onApply, onKeywords }: SeoOptimizerPanelProps) {
  const [suggestion, setSuggestion] = useState<SeoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSeo() {
    if (disabled || loading) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/seo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, title, summary, content }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "SEO optimization failed.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { suggestion: SeoResponse };
      setSuggestion(data.suggestion);
      onKeywords(data.suggestion.keywords ?? [], data.suggestion.faqs ?? []);
    } catch (error) {
      console.error("SEO optimizer failed", error);
      setError("Unable to generate SEO suggestion.");
    } finally {
      setLoading(false);
    }
  }

  function applySeo() {
    if (!suggestion) {
      return;
    }
    onApply({
      title: suggestion.title,
      summary: suggestion.metaDescription,
      slug: suggestion.slug,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">SEO optimizer</h2>
        <Badge variant={disabled ? "warning" : suggestion ? "success" : "default"}>
          {disabled ? "Disabled" : suggestion ? "Optimized" : "Idle"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">Generate title, meta description, slug, and keywords with duplicate checks.</p>
      <Button type="button" size="sm" onClick={runSeo} disabled={disabled || loading}>
        {loading ? "Optimizing…" : "Optimize SEO"}
      </Button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      {suggestion ? (
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <Label>Suggested title</Label>
            <Input value={suggestion.title} readOnly />
          </div>
          <div className="space-y-1">
            <Label>Meta description</Label>
            <Textarea value={suggestion.metaDescription} readOnly className="min-h-[80px]" />
          </div>
          <div className="space-y-1">
            <Label>Slug</Label>
            <Input value={suggestion.slug} readOnly />
            <p className="text-[11px] text-muted-foreground">Current slug: {slug || "(auto)"}</p>
            {suggestion.validation && !suggestion.validation.slugAvailable ? (
              <p className="text-[11px] text-red-500">Slug adjusted to avoid duplication.</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Keywords ({suggestion.keywords.length})</Label>
            <div className="flex flex-wrap gap-1">
              {suggestion.keywords.map((keyword) => (
                <Badge key={keyword} variant="info">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
          {suggestion.validation && suggestion.validation.conflictingTitles.length ? (
            <div className="space-y-1">
              <Label>Similar titles detected</Label>
              <ul className="list-disc space-y-1 pl-4">
                {suggestion.validation.conflictingTitles.map((item) => (
                  <li key={item.id}>
                    {item.title} ({item.similarity})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-md border border-border bg-background/60 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">SERP preview</p>
            <div className="mt-1 space-y-1">
              <p className="text-sm font-semibold text-primary">{suggestion.title}</p>
              <p className="text-[11px] text-emerald-600">devlogia.com/{suggestion.slug}</p>
              <p className="text-[12px] text-muted-foreground">{suggestion.metaDescription}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>FAQs</Label>
            <ul className="list-disc space-y-1 pl-4">
              {suggestion.faqs.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={applySeo}>
            Apply to post
          </Button>
        </div>
      ) : null}
    </div>
  );
}
