"use client";

import { useState } from "react";

type GeneratorState = {
  status: "idle" | "loading" | "ready" | "error";
  report: string;
  error?: string;
  generatedAt?: string;
};

type InsightsReportGeneratorProps = {
  range?: number;
};

export function InsightsReportGenerator({ range = 30 }: InsightsReportGeneratorProps) {
  const [state, setState] = useState<GeneratorState>({ status: "idle", report: "" });

  async function handleGenerate() {
    setState({ status: "loading", report: "Generating AI report…" });
    try {
      const response = await fetch("/api/insights/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: String(range) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.error === "string" ? payload.error : `Failed with status ${response.status}`;
        throw new Error(message);
      }
      const payload = (await response.json()) as { report: string; generatedAt?: string };
      setState({ status: "ready", report: payload.report, generatedAt: payload.generatedAt });
    } catch (error) {
      setState({ status: "error", report: "", error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  function handleDownload(format: "markdown" | "pdf") {
    const url = new URL("/api/insights/ai-report", window.location.origin);
    url.searchParams.set("format", format);
    url.searchParams.set("range", String(range));
    window.open(url.toString(), "_blank");
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">AI insight report</h2>
          <p className="text-xs text-muted-foreground">Generate a markdown summary of engagement insights.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={handleGenerate}
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? "Generating…" : "Generate AI Report"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => handleDownload("markdown")}
            disabled={state.status === "loading"}
          >
            Download .md
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => handleDownload("pdf")}
            disabled={state.status === "loading"}
          >
            Download .pdf
          </button>
        </div>
      </header>
      {state.status === "error" ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      {state.report ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-xs leading-6 text-foreground">
          {state.report}
        </pre>
      ) : state.status === "idle" ? (
        <p className="text-sm text-muted-foreground">Reports summarize insights across the selected range.</p>
      ) : null}
      {state.generatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">Generated {new Date(state.generatedAt).toLocaleString()}</p>
      ) : null}
    </section>
  );
}
