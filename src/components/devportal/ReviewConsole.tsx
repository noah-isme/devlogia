"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { SubmissionSummary } from "./SubmissionsConsole";

type ReviewResponse = {
  submissions: SubmissionSummary[];
};

type ReviewDraft = {
  status: SubmissionSummary["status"];
  notes: string;
  badges: string;
  checklist: string;
};

export function ReviewConsole() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function resolveDraft(id: string): ReviewDraft {
    return (
      drafts[id] ?? {
        status: submissions.find((item) => item.id === id)?.status ?? "in_review",
        notes: submissions.find((item) => item.id === id)?.notes ?? "",
        badges: submissions.find((item) => item.id === id)?.badges.join(", ") ?? "",
        checklist: "",
      }
    );
  }

  async function loadAll() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/devportal/submissions?scope=all", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load submissions (${response.status})`);
      }
      const payload = (await response.json()) as ReviewResponse;
      setSubmissions(payload.submissions);
      setError(null);
    } catch (err) {
      console.error("Failed to load review data", err);
      setError(err instanceof Error ? err.message : "Unable to load submissions");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitReview(id: string) {
    const draft = resolveDraft(id);
    try {
      const response = await fetch(`/api/internal/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          notes: draft.notes,
          badges: draft.badges.split(",").map((badge) => badge.trim()).filter(Boolean),
          checklist: draft.checklist
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Review update failed (${response.status})`);
      }
      await loadAll();
    } catch (err) {
      console.error("Failed to update review", err);
      setError(err instanceof Error ? err.message : "Unable to save review");
    }
  }

  useEffect(() => {
    loadAll().catch((err) => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review console</h1>
        <p className="text-sm text-muted-foreground">
          Checklist-driven approvals with badge assignment and reviewer commentary.
        </p>
      </header>
      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p> : null}
      <div className={cn("grid gap-4", isLoading && "opacity-60")} aria-busy={isLoading}>
        {submissions.length ? (
          submissions.map((submission) => {
            const draft = resolveDraft(submission.id);
            return (
              <article key={submission.id} className="space-y-4 rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{submission.repoUrl}</h2>
                    <p className="text-xs text-muted-foreground">Version {submission.version}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      submission.status === "approved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : submission.status === "rejected"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    {submission.status}
                  </span>
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="font-medium text-foreground">Scopes</p>
                    <p>{submission.scopes.join(", ")}</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Badges</p>
                    <p>{submission.badges.length ? submission.badges.join(", ") : "Pending"}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Status</span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [submission.id]: { ...draft, status: event.target.value as SubmissionSummary["status"] },
                        }))
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="in_review">In review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Request changes</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Badges</span>
                    <Input
                      value={draft.badges}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [submission.id]: { ...draft, badges: event.target.value } }))
                      }
                      placeholder="featured,ai-ready"
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Reviewer notes</span>
                  <Textarea
                    value={draft.notes}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [submission.id]: { ...draft, notes: event.target.value } }))}
                    rows={4}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Checklist (one item per line)</span>
                  <Textarea
                    value={draft.checklist}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [submission.id]: { ...draft, checklist: event.target.value } }))
                    }
                    rows={4}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setDrafts((prev) => {
                        const next = { ...prev };
                        delete next[submission.id];
                        return next;
                      })
                    }
                  >
                    Reset
                  </Button>
                  <Button type="button" onClick={() => submitReview(submission.id)}>
                    Save review
                  </Button>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No submissions available yet.
          </p>
        )}
      </div>
    </div>
  );
}
