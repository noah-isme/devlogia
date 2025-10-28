"use client";

import { useState } from "react";

type Preferences = {
  personalizationOptOut: boolean;
  analyticsOptOut: boolean;
  segment?: string | null;
  lastInsightRefresh?: string | null;
};

type AIPrivacyFormProps = {
  initial: Preferences;
};

export function AIPrivacyForm({ initial }: AIPrivacyFormProps) {
  const [state, setState] = useState<Preferences>(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function update(preferences: Partial<Preferences>) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = (await response.json()) as Preferences;
      setState(data);
      setMessage("Preferences updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update preferences");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-border/60 bg-muted/30 p-4">
      <header>
        <h2 className="text-base font-semibold">AI privacy controls</h2>
        <p className="text-sm text-muted-foreground">
          Manage personalization preferences, analytics anonymization, and export insight reports.
        </p>
      </header>
      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.personalizationOptOut}
            disabled={loading}
            onChange={(event) => update({ personalizationOptOut: event.target.checked })}
          />
          <span>
            <span className="font-medium">Opt-out of personalized feeds</span>
            <span className="block text-xs text-muted-foreground">
              Disables affinity updates and forces trending fallback for personal feeds.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.analyticsOptOut}
            disabled={loading}
            onChange={(event) => update({ analyticsOptOut: event.target.checked })}
          />
          <span>
            <span className="font-medium">Anonymize analytics telemetry</span>
            <span className="block text-xs text-muted-foreground">
              Removes user identifiers from new telemetry and AI usage events.
            </span>
          </span>
        </label>
      </div>
      <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
        <p>
          Segment: {state.segment ?? "unknown"} · Last refresh: {state.lastInsightRefresh ? new Date(state.lastInsightRefresh).toLocaleString() : "n/a"}
        </p>
      </div>
      <button
        type="button"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-background/70"
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            const response = await fetch("/api/admin/privacy/export");
            if (!response.ok) {
              throw new Error("Export failed");
            }
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `devlogia-insights-${Date.now()}.json`;
            link.click();
            URL.revokeObjectURL(url);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Export failed");
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
      >
        Export insights JSON
      </button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
