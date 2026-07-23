"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";

export type PageSummary = {
  id: string;
  title: string;
  slug: string;
  contentMdx: string;
  published: boolean;
  revisions: PageRevisionSummary[];
};

export type PageRevisionSummary = {
  id: string;
  reason: string;
  title: string;
  contentMdx?: string;
  createdAt: string;
};

type PageManagerProps = {
  initialPages: PageSummary[];
};

export function PageManager({ initialPages }: PageManagerProps) {
  const [pages, setPages] = useState<PageSummary[]>(initialPages);
  const [selectedId, setSelectedId] = useState<string | null>(initialPages[0]?.id ?? null);
  const [draft, setDraft] = useState<PageSummary | null>(initialPages[0] ?? null);
  const [previewRevision, setPreviewRevision] = useState<PageRevisionSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const orderedPages = useMemo(
    () => [...pages].sort((a, b) => a.title.localeCompare(b.title)),
    [pages],
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const next = pages.find((page) => page.id === id) ?? null;
    setDraft(next);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New page" }),
      });

      if (!response.ok) {
        throw new Error("Failed to create page");
      }

      const data = await response.json();
      const newPage: PageSummary = {
        id: data.page.id,
        title: data.page.title,
        slug: data.page.slug,
        contentMdx: data.page.contentMdx,
        published: data.page.published,
        revisions: [],
      };

      setPages((prev) => [...prev, newPage]);
      setSelectedId(newPage.id);
      setDraft(newPage);
      toast.success("Page created", { description: "Use the editor panel to update details." });
    } catch (error) {
      console.error(error);
      toast.error("Unable to create page", { description: "Please try again after checking your connection." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = <K extends keyof PageSummary>(key: K, value: PageSummary[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/pages/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: draft.title,
          slug: slugify(draft.slug),
          contentMdx: draft.contentMdx,
          published: draft.published,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update page");
      }

      const data = await response.json();
      const updated: PageSummary = {
        id: data.page.id,
        title: data.page.title,
        slug: data.page.slug,
        contentMdx: data.page.contentMdx,
        published: data.page.published,
        revisions: draft.revisions,
      };

      setPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
      setDraft(updated);
      toast.success("Page saved", { description: "Changes published to the live site." });
    } catch (error) {
      console.error(error);
      toast.error("Unable to save page", { description: "Review your changes and try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    if (!draft) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/pages/${draft.id}/revisions/${revisionId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to restore page revision");
      }
      const data = await response.json();
      const updatedRevisions = data.revisions
        ? data.revisions.map((rev: { id: string; reason: string; title: string; contentMdx?: string; createdAt: string | Date }) => ({
            id: rev.id,
            reason: rev.reason,
            title: rev.title,
            contentMdx: rev.contentMdx,
            createdAt: typeof rev.createdAt === "string" ? rev.createdAt : new Date(rev.createdAt).toISOString(),
          }))
        : draft.revisions.filter((revision) => revision.id !== revisionId);

      const restored: PageSummary = {
        id: data.page.id,
        title: data.page.title,
        slug: data.page.slug,
        contentMdx: data.page.contentMdx,
        published: data.page.published,
        revisions: updatedRevisions,
      };
      setPages((prev) => prev.map((page) => (page.id === restored.id ? restored : page)));
      setDraft(restored);
      setPreviewRevision(null);
      toast.success("Revision restored", { description: "The page now matches the selected snapshot." });
    } catch (error) {
      console.error(error);
      toast.error("Unable to restore revision", { description: "Please try another revision." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/pages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete page");
      }

      setPages((prev) => prev.filter((page) => page.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setDraft(null);
      }
      toast.success("Page deleted", { description: "The content is no longer visible." });
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete page", { description: "We couldn't remove the page." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pages</h2>
          <Button onClick={handleCreate} disabled={isSaving}>
            New page
          </Button>
        </div>
        <ul className="space-y-2">
          {orderedPages.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                onClick={() => handleSelect(page.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedId === page.id
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-foreground/70"
                }`}
              >
                <span>
                  <span className="block font-medium">{page.title}</span>
                  <span className="text-xs text-muted-foreground">/{page.slug}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {page.published ? "Published" : "Draft"}
                </span>
              </button>
            </li>
          ))}
          {orderedPages.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No pages yet.
            </li>
          ) : null}
        </ul>
      </section>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editor</h2>
          {draft ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving}
              onClick={() => handleDelete(draft.id)}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="page-title">Title</Label>
              <Input
                id="page-title"
                value={draft.title}
                onChange={(event) => handleFieldChange("title", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-slug">Slug</Label>
              <Input
                id="page-slug"
                value={draft.slug}
                onChange={(event) => handleFieldChange("slug", event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="page-published"
                type="checkbox"
                checked={draft.published}
                onChange={(event) => handleFieldChange("published", event.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="page-published">Published</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="page-content">Content</Label>
              <Textarea
                id="page-content"
                className="min-h-[240px]"
                value={draft.contentMdx}
                onChange={(event) => handleFieldChange("contentMdx", event.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <div>
                <h3 className="text-sm font-semibold">Revision history</h3>
                <p className="text-xs text-muted-foreground">Restore a previous save or publish snapshot.</p>
              </div>
              {draft.revisions.length ? (
                <ul className="space-y-2">
                  {draft.revisions.map((revision) => (
                    <li key={revision.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-2 text-xs">
                      <span>
                        <span className="block font-medium">{revision.title}</span>
                        <span className="text-muted-foreground">
                          {revision.reason} · {new Date(revision.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={() => setPreviewRevision(revision)}>
                          Preview
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => void handleRestoreRevision(revision.id)}>
                          Restore
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No revisions yet.</p>
              )}
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Select a page to start editing.</p>
        )}
      </section>
      {previewRevision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-semibold">{previewRevision.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Reason: <span className="font-medium text-foreground">{previewRevision.reason}</span> · Saved: {new Date(previewRevision.createdAt).toLocaleString()}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewRevision(null)}>
                ✕
              </Button>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Content Preview (MDX):</span>
              <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-3 text-xs font-mono text-foreground">
                {previewRevision.contentMdx ?? "No preview content available."}
              </pre>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setPreviewRevision(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={() => {
                  const revId = previewRevision.id;
                  setPreviewRevision(null);
                  void handleRestoreRevision(revId);
                }}
              >
                Restore this revision
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
