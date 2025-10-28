"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { ToneAnalysisResult, TonePreset } from "@/lib/ai/types";

type ToneStylePanelProps = {
  disabled: boolean;
  postId: string | null;
  content: string;
  onApply: (nextContent: string) => void;
};

const presets: TonePreset[] = ["Technical Guide", "Narrative Devlog", "Brief Note"];

export function ToneStylePanel({ disabled, postId, content, onApply }: ToneStylePanelProps) {
  const [preset, setPreset] = useState<TonePreset>("Technical Guide");
  const [analysis, setAnalysis] = useState<ToneAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    if (disabled || loading) {
      return;
    }
    if (!content.trim()) {
      setError("Add content before analyzing tone.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/ai/tone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, preset, postId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Tone analysis failed.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as { analysis: ToneAnalysisResult["analysis"]; usage: ToneAnalysisResult["usage"] };
      setAnalysis({ analysis: data.analysis, usage: data.usage });
    } catch (error) {
      console.error("Tone analysis failed", error);
      setError("Unable to analyze tone.");
    } finally {
      setLoading(false);
    }
  }

  function applySuggestions() {
    if (!analysis) {
      return;
    }
    let next = content;
    for (const suggestion of analysis.analysis.suggestions.slice(0, 5)) {
      if (suggestion.before && suggestion.after) {
        next = next.replace(suggestion.before.trim(), suggestion.after.trim());
      } else if (suggestion.before) {
        const trimmed = suggestion.before.trim();
        const shortened = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
        next = next.replace(trimmed, shortened);
      }
    }
    const delta = Math.abs(next.length - content.length) / Math.max(content.length, 1);
    if (delta > 0.1) {
      const ratio = (delta * 100).toFixed(1);
      setError(`Suggestions would change ${ratio}% of the draft. Refine selection manually.`);
      return;
    }
    onApply(next);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tone & style analyzer</h2>
        <Badge variant={disabled ? "warning" : analysis ? "success" : "default"}>
          {disabled ? "Disabled" : analysis ? "Analyzed" : "Idle"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">Check tone consistency, readability, and improvement suggestions.</p>
      <div className="space-y-2">
        <Label htmlFor="tone-preset">Style preset</Label>
        <Select
          id="tone-preset"
          value={preset}
          onChange={(event) => setPreset(event.target.value as TonePreset)}
          disabled={disabled || loading}
        >
          {presets.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>
      <Button type="button" size="sm" onClick={runAnalysis} disabled={disabled || loading}>
        {loading ? "Analyzing…" : "Analyze tone"}
      </Button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      {analysis ? (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Tone: {analysis.analysis.tone}</Badge>
            <Badge variant="success">Readability: {analysis.analysis.readability}</Badge>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Suggestions</p>
            <ul className="list-disc space-y-1 pl-4">
              {analysis.analysis.suggestions.length ? (
                analysis.analysis.suggestions.map((item, index) => (
                  <li key={`${item.description}-${index}`}>
                    <span className="font-medium">{item.description}</span>
                    {item.before ? <span className="text-muted-foreground"> · {item.before.slice(0, 80)}</span> : null}
                  </li>
                ))
              ) : (
                <li>No edits recommended — looking good!</li>
              )}
            </ul>
          </div>
          {analysis.analysis.adjustments.length ? (
            <div>
              <p className="font-medium">Preset alignment</p>
              <ul className="list-disc space-y-1 pl-4">
                {analysis.analysis.adjustments.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={applySuggestions}>
            Apply suggestions
          </Button>
        </div>
      ) : (
        <Textarea value={content} readOnly className="min-h-[120px] text-xs" />
      )}
    </div>
  );
}
