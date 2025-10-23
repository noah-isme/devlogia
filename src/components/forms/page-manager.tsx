"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";

export type PageSummary = {
  id: string;
  title: string;
  slug: string;
  contentMdx: string;
  published: boolean;
};

type PageManagerProps = {
  initialPages: PageSummary[];
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function PageManager({ initialPages }: PageManagerProps) {
  const [pages, setPages] = useState<PageSummary[]>(initialPages);
  const [selectedId, setSelectedId] = useState<string | null>(initialPages[0]?.id ?? null);
  const [draft, setDraft] = useState<PageSummary | null>(initialPages[0] ?? null);
  const [toast, setToast] = useState<ToastState>(null);
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
    setToast(null);
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
      };

      setPages((prev) => [...prev, newPage]);
      setSelectedId(newPage.id);
      setDraft(newPage);
      setToast({ type: "success", message: "Page created" });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: "Unable to create page" });
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
    setToast(null);

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
      };

      setPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
      setDraft(updated);
      setToast({ type: "success", message: "Page saved" });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: "Unable to save page" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    setToast(null);
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
      setToast({ type: "success", message: "Page deleted" });
    } catch (error) {
      console.error(error);
      setToast({ type: "error", message: "Unable to delete page" });
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
        {toast ? (
          <p
            className={`rounded-md border px-3 py-2 text-sm ${
              toast.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-red-500/40 bg-red-500/10 text-red-600"
            }`}
          >
            {toast.message}
          </p>
        ) : null}
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
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Select a page to start editing.</p>
        )}
      </section>
    </div>
  );
}
