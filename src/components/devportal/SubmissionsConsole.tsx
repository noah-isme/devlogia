"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SubmissionSummary = {
  id: string;
  repoUrl: string;
  version: string;
  manifest: string;
  scopes: string[];
  status: string;
  badges: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type SubmissionResponse = {
  submissions: SubmissionSummary[];
};

type CreateSubmissionPayload = {
  repoUrl: string;
  version: string;
  manifest: string;
  scopes: string;
};

export function SubmissionsConsole() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSubmissionPayload>({ repoUrl: "", version: "", manifest: "", scopes: "content:read" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const badgeStats = useMemo(() => {
    const approved = submissions.filter((item) => item.status === "approved");
    return {
      total: submissions.length,
      approved: approved.length,
      approvalRate: submissions.length ? Math.round((approved.length / submissions.length) * 100) : 0,
    };
  }, [submissions]);

  async function loadSubmissions() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/devportal/submissions", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load submissions (${response.status})`);
      }
      const payload = (await response.json()) as SubmissionResponse;
      setSubmissions(payload.submissions);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch submissions", err);
      setError(err instanceof Error ? err.message : "Unable to load submissions");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/devportal/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: form.repoUrl,
          version: form.version,
          manifest: form.manifest,
          scopes: form.scopes.split(",").map((scope) => scope.trim()),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Unable to create submission (${response.status})`);
      }
      await loadSubmissions();
      setForm({ repoUrl: "", version: "", manifest: "", scopes: "content:read" });
    } catch (err) {
      console.error("Failed to submit", err);
      setError(err instanceof Error ? err.message : "Unable to create submission");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    loadSubmissions().catch((err) => console.error(err));
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 rounded-lg border border-border bg-muted/20 p-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Submissions</p>
          <p className="text-2xl font-semibold">{badgeStats.total}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Approved</p>
          <p className="text-2xl font-semibold">{badgeStats.approved}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Approval rate</p>
          <p className="text-2xl font-semibold">{badgeStats.approvalRate}%</p>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">Create submission</h2>
          <p className="text-sm text-muted-foreground">Provide repository details, manifest JSON, and requested scopes.</p>
        </header>
        <form onSubmit={submitForm} className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Repository URL</span>
            <Input value={form.repoUrl} onChange={(event) => setForm((prev) => ({ ...prev, repoUrl: event.target.value }))} required />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Version</span>
            <Input value={form.version} onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))} required />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Manifest JSON</span>
            <Textarea
              value={form.manifest}
              onChange={(event) => setForm((prev) => ({ ...prev, manifest: event.target.value }))}
              rows={6}
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Scopes</span>
            <Input
              value={form.scopes}
              onChange={(event) => setForm((prev) => ({ ...prev, scopes: event.target.value }))}
              placeholder="content:read,analytics:view"
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">Submission history</h2>
          <p className="text-sm text-muted-foreground">Track feedback, badges, and review decisions in real-time.</p>
        </header>
        {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p> : null}
        <div className={cn("grid gap-4", isLoading && "opacity-60")}
          aria-busy={isLoading}
        >
          {submissions.length ? (
            submissions.map((submission) => (
              <article key={submission.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{submission.repoUrl}</h3>
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
                <dl className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <dt className="font-medium text-foreground">Scopes</dt>
                    <dd>{submission.scopes.join(", ") || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Badges</dt>
                    <dd>{submission.badges.length ? submission.badges.join(", ") : "Pending"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Submitted</dt>
                    <dd>{new Date(submission.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Updated</dt>
                    <dd>{new Date(submission.updatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
                {submission.notes ? (
                  <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Review notes: {submission.notes}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              No submissions yet. Create one above to kick off a review cycle.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
