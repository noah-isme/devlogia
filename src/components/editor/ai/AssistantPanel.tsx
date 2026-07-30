"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { RelatedPost, ResearchSource, WriterAction } from "@/lib/ai/types";

type AssistantPanelProps = {
  disabled: boolean;
  postId: string | null;
  title: string;
  summary: string;
  tags: string[];
  content: string;
  selection: { text: string; hasSelection: boolean };
  canResearchNews: boolean;
  onApply: (mode: "replace-selection" | "append" | "insert" | "replace-all", content: string) => void;
};

const writerActions: Array<{
  action: WriterAction;
  label: string;
  description: string;
  requiresSelection?: boolean;
  targetLanguage?: "en" | "id" | "es" | "fr" | "de" | "ja";
}> = [
  {
    action: "draft",
    label: "Generate Draft",
    description: "Create a fresh MDX outline and key sections from title and summary.",
  },
  {
    action: "continue",
    label: "Continue Writing",
    description: "Extend the draft with additional paragraphs and suggestions.",
  },
  {
    action: "rewrite_clarity",
    label: "Rewrite for Clarity",
    description: "Improve the selected text while keeping intent intact.",
    requiresSelection: true,
  },
  {
    action: "rewrite_concise",
    label: "Rewrite Concise",
    description: "Make the selected text shorter and tighter.",
    requiresSelection: true,
  },
  {
    action: "translate_en",
    label: "Translate → English",
    description: "Convert the selection to English without breaking MDX.",
    requiresSelection: true,
    targetLanguage: "en",
  },
  {
    action: "translate_id",
    label: "Translate → Indonesian",
    description: "Terjemahkan ke Bahasa Indonesia sambil menjaga format MDX.",
    requiresSelection: true,
    targetLanguage: "id",
  },
];

const LOCAL_TEMPLATE_KEY = "devlogia-ai-writer-template";

export function AssistantPanel({ disabled, postId, title, summary, tags, content, selection, canResearchNews, onApply }: AssistantPanelProps) {
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [currentAction, setCurrentAction] = useState<WriterAction | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ tokensIn: number; tokensOut: number; cost: string } | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("Keep tone practical and friendly. Use short paragraphs.");
  const [researchQuery, setResearchQuery] = useState("");
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [researchToken, setResearchToken] = useState<string | null>(null);
  const [selectedSourceUrls, setSelectedSourceUrls] = useState<string[]>([]);
  const [researching, setResearching] = useState(false);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCAL_TEMPLATE_KEY);
    if (stored) {
      setCustomInstructions(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_TEMPLATE_KEY, customInstructions);
  }, [customInstructions]);

  useEffect(() => {
    if (!postId) {
      return;
    }
    setIsLoadingRelated(true);
    fetch(`/api/recommend?postId=${postId}&limit=5`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }
        const body = (await response.json()) as { items?: Array<{ id: string; title: string; summary?: string }> };
        return (body.items ?? []).map((item) => ({ id: item.id, title: item.title, summary: item.summary }));
      })
      .catch(() => [])
      .then((items) => {
        setRelatedPosts(items);
        setIsLoadingRelated(false);
      });
  }, [postId]);

  const selectionSummary = useMemo(() => {
    if (!selection.hasSelection) {
      return "No selection";
    }
    if (selection.text.length > 120) {
      return `${selection.text.slice(0, 120)}…`;
    }
    return selection.text;
  }, [selection]);

  async function runAction(action: WriterAction) {
    if (disabled || streaming) {
      return;
    }
    if (action !== "draft" && !content.trim() && action !== "translate_id" && action !== "translate_en") {
      setError("Add some content before requesting this action.");
      return;
    }
    if (writerActions.find((item) => item.action === action)?.requiresSelection && !selection.hasSelection) {
      setError("Select text in the editor to run this action.");
      return;
    }
    if (action === "draft_from_sources" && (!researchToken || !selectedSourceUrls.length)) {
      setError("Research current news and select at least one source first.");
      return;
    }

    abortCurrent();
    setCurrentAction(action);
    setStreaming(true);
    setError(null);
    setOutput("");
    setUsage(null);
    setBudgetStatus(null);

    try {
      const controller = new AbortController();
      abortController.current = controller;
      const response = await fetch("/api/ai/writer", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          action,
          title,
          summary,
          tags,
          content,
          selection: selection.text,
          relatedPosts,
          styleGuide: customInstructions,
          targetLanguage: writerActions.find((item) => item.action === action)?.targetLanguage,
          researchToken: action === "draft_from_sources" ? researchToken : undefined,
          sourceUrls: action === "draft_from_sources" ? selectedSourceUrls : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : `AI request failed (${response.status}).`);
        setStreaming(false);
        return;
      }

      const tokensIn = Number(response.headers.get("X-AI-Usage-Tokens-In") ?? "0");
      const tokensOut = Number(response.headers.get("X-AI-Usage-Tokens-Out") ?? "0");
      const cost = response.headers.get("X-AI-Cost-USD") ?? "0";
      setUsage({ tokensIn, tokensOut, cost });
      setBudgetStatus(response.headers.get("X-AI-Budget-Status"));

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        setOutput(text);
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          setOutput((prev) => prev + decoder.decode(value, { stream: !doneReading }));
        }
      }
      setStreaming(false);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }
      console.error("AI writer request failed", error);
      setError("Unable to contact AI assistant.");
      setStreaming(false);
    } finally {
      abortController.current = null;
    }
  }

  async function searchNews() {
    if (researchQuery.trim().length < 3 || researching) return;
    setResearching(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/news/search", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: researchQuery }) });
      const data = (await response.json()) as { sources?: ResearchSource[]; researchToken?: string; error?: string };
      if (!response.ok || !data.sources || !data.researchToken) throw new Error(data.error || "News research failed");
      setResearchSources(data.sources);
      setResearchToken(data.researchToken);
      setSelectedSourceUrls(data.sources.map((source) => source.url));
    } catch (error) {
      setError(error instanceof Error ? error.message : "News research failed");
    } finally {
      setResearching(false);
    }
  }

  function abortCurrent() {
    abortController.current?.abort();
    abortController.current = null;
    setStreaming(false);
  }

  function applyResult(mode: "replace-selection" | "append" | "insert" | "replace-all") {
    if (!output.trim()) {
      return;
    }
    onApply(mode, output.trim());
  }

  async function download(format: "md" | "pdf") {
    if (!output.trim()) {
      return;
    }
    const response = await fetch("/api/ai/export", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: output, format }),
    });
    if (!response.ok) {
      setError("Failed to prepare export.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    anchor.href = url;
    anchor.download = format === "pdf" ? `ai-draft-${stamp}.pdf` : `ai-draft-${stamp}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        <Badge variant={disabled ? "warning" : streaming ? "info" : "default"}>
          {disabled ? "Disabled" : streaming ? "Streaming" : "Ready"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Draft, continue, rewrite, or translate snippets directly in the editor. Streaming responses keep latency under a few
        seconds.
      </p>

      <div className="space-y-2">
        <Label htmlFor="ai-custom">Custom instructions</Label>
        <Textarea
          id="ai-custom"
          value={customInstructions}
          onChange={(event) => setCustomInstructions(event.target.value)}
          className="min-h-[80px] text-xs"
          placeholder="Set tone, formatting preferences, or guardrails."
        />
        <p className="text-[11px] text-muted-foreground">Stored locally so you can tweak templates without redeploy.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {writerActions.map((item) => (
          <Button
            key={item.action}
            type="button"
            size="sm"
            variant={currentAction === item.action && streaming ? "default" : "outline"}
            disabled={disabled || streaming || (item.requiresSelection && !selection.hasSelection)}
            onClick={() => runAction(item.action)}
          >
            {item.label}
          </Button>
        ))}
        {streaming ? (
          <Button type="button" size="sm" variant="ghost" onClick={abortCurrent}>
            Stop
          </Button>
        ) : null}
      </div>

      {canResearchNews ? (
        <section className="space-y-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
          <div><p className="font-medium">Current-news research</p><p className="text-muted-foreground">Select dated sources. AI will cite only the selected links.</p></div>
          <div className="flex gap-2"><Input value={researchQuery} onChange={(event) => setResearchQuery(event.target.value)} placeholder="Topic or news angle" /><Button type="button" size="sm" variant="outline" disabled={researching || researchQuery.trim().length < 3} onClick={() => void searchNews()}>{researching ? "Searching…" : "Research"}</Button></div>
          {researchSources.map((source) => <label key={source.url} className="flex gap-2 rounded border border-border p-2"><input type="checkbox" checked={selectedSourceUrls.includes(source.url)} onChange={(event) => setSelectedSourceUrls((current) => event.target.checked ? [...current, source.url] : current.filter((url) => url !== source.url))} /><span><a className="font-medium underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a><span className="block text-muted-foreground">{source.publisher} · {new Date(source.publishedAt).toLocaleDateString()}</span><span className="block text-muted-foreground">{source.description}</span></span></label>)}
          {researchSources.length ? <Button type="button" size="sm" disabled={disabled || streaming || !selectedSourceUrls.length} onClick={() => runAction("draft_from_sources")}>Draft from selected sources</Button> : null}
        </section>
      ) : null}

      <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
        <p className="font-medium">Selection preview</p>
        <p className="whitespace-pre-wrap text-muted-foreground">{selectionSummary}</p>
        {isLoadingRelated ? (
          <p className="text-muted-foreground">Loading related posts…</p>
        ) : relatedPosts.length ? (
          <div className="flex flex-wrap gap-1">
            {relatedPosts.map((post) => (
              <Badge key={post.id} variant="info">
                {post.title}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="space-y-2">
        <Label htmlFor="ai-output">AI output</Label>
        <Textarea id="ai-output" value={output} readOnly className="min-h-[180px] font-mono text-xs" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => applyResult("replace-selection")} disabled={!output}>
            Replace selection
          </Button>
          <Button type="button" size="sm" onClick={() => applyResult("insert")} disabled={!output}>
            Insert at cursor
          </Button>
          <Button type="button" size="sm" onClick={() => applyResult("append")} disabled={!output}>
            Append to end
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyResult("replace-all")} disabled={!output}>
            Replace entire draft
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => download("md")} disabled={!output}>
              Export .md
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => download("pdf")} disabled={!output}>
              Export .pdf
            </Button>
          </div>
        </div>
        {usage ? (
          <p className="text-[11px] text-muted-foreground">
            Usage · in: {usage.tokensIn} tokens · out: {usage.tokensOut} tokens · cost: ${usage.cost}
            {budgetStatus === "warning" ? " · nearing monthly budget" : budgetStatus === "exceeded" ? " · budget exceeded" : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
