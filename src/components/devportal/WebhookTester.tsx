"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const templates = {
  "submission.updated": {
    event: "submission.updated",
    payload: {
      id: "sub_123",
      status: "in_review",
      repoUrl: "https://github.com/devlogia/example",
      version: "1.0.0",
      scopes: ["content:read"],
    },
  },
  "review.result": {
    event: "review.result",
    payload: {
      id: "sub_123",
      decision: "approved",
      badges: ["featured", "ai-ready"],
      reviewer: "reviewer@devlogia.app",
    },
  },
  "payout.paid": {
    event: "payout.paid",
    payload: {
      payoutId: "pay_123",
      amount: 4200,
      currency: "usd",
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
    },
  },
} as const;

type TesterResult = {
  status: number;
  latencyMs: number;
  body: string;
  timestamp: string;
};

type TemplateKey = keyof typeof templates;

export function WebhookTester() {
  const [template, setTemplate] = useState<TemplateKey>("submission.updated");
  const [targetUrl, setTargetUrl] = useState("https://localhost:3001/webhooks/devlogia");
  const [headers, setHeaders] = useState("X-Debug: true");
  const [payload, setPayload] = useState(() => JSON.stringify(templates["submission.updated"].payload, null, 2));
  const [result, setResult] = useState<TesterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPayload(JSON.stringify(templates[template].payload, null, 2));
  }, [template]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      let parsedPayload: unknown = null;
      if (payload.trim()) {
        parsedPayload = JSON.parse(payload);
      }
      const additionalHeaders = headers
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, line) => {
          const [key, ...rest] = line.split(":");
          if (key && rest.length) {
            acc[key.trim()] = rest.join(":").trim();
          }
          return acc;
        }, {});

      const response = await fetch("/api/devportal/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          event: templates[template].event,
          payload: parsedPayload,
          headers: additionalHeaders,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Webhook failed (${response.status})`);
      }
      setResult({
        status: body.result?.status ?? response.status,
        latencyMs: body.result?.latencyMs ?? 0,
        body: typeof body.result?.body === "string" ? body.result.body : JSON.stringify(body.result?.body ?? {}, null, 2),
        timestamp: body.result?.timestamp ?? new Date().toISOString(),
      });
      setError(null);
    } catch (err) {
      console.error("Webhook test failed", err);
      setError(err instanceof Error ? err.message : "Unable to send webhook");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Webhook tester</h1>
        <p className="text-sm text-muted-foreground">
          Send signed webhook events with replay protection. Responses are captured for debugging.
        </p>
      </header>
      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Event template</span>
          <select
            value={template}
            onChange={(event) => setTemplate(event.target.value as TemplateKey)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.keys(templates).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Target URL</span>
          <Input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} required />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Additional headers (one per line)</span>
          <Textarea value={headers} onChange={(event) => setHeaders(event.target.value)} rows={3} />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Payload (JSON)</span>
          <Textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={8} required />
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send test event"}
          </Button>
        </div>
      </form>
      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">Status: {result.status}</span>
            <span className="text-muted-foreground">Latency: {result.latencyMs.toFixed(0)}ms</span>
            <span className="text-muted-foreground">{new Date(result.timestamp).toLocaleString()}</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
            <code>{result.body}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
