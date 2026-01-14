"use client";

import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useEditorDraft } from "@/components/editor/hooks/useEditorDraft";
import { useEditorPreview } from "@/components/editor/hooks/useEditorPreview";
import { useEditorUpload } from "@/components/editor/hooks/useEditorUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EditorPost, PostStatus } from "@/components/editor/types";
import type { Role } from "@/lib/rbac";
import { postStatusValues } from "@/lib/validations/post";
import { slugify } from "@/lib/utils";
import { AssistantPanel } from "@/components/editor/ai/AssistantPanel";
import { ToneStylePanel } from "@/components/editor/ai/ToneStylePanel";
import { SeoOptimizerPanel } from "@/components/editor/ai/SeoOptimizerPanel";
import { OutlineHeadlinePanel } from "@/components/editor/ai/OutlineHeadlinePanel";

type PostEditorProps = {
  initialPost?: EditorPost;
  mode: "create" | "edit";
  role: Role;
  aiEnabled: boolean;
};

export function PostEditor({ initialPost, mode, role, aiEnabled }: PostEditorProps) {
  const {
    post,
    setPost,
    latestState,
    updateField,
    setAutosaveState,
    autosaveDescription,
    pendingRestore,
    handleRestoreDraft,
    handleDiscardDraft,
    persistChanges,
    cancelAutosave,
    clearPersistedDraft,
  } = useEditorDraft({ initialPost, mode });
  const { activeView, previewHtml, previewError, handleSwitchView } = useEditorPreview(
    () => latestState.current.contentMdx,
  );
  const { fileInputRef, uploadState, uploadMessage, openFileDialog, handleFileChange } = useEditorUpload({
    latestState,
    setPost,
    setAutosaveState,
  });
  const [actionState, setActionState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [lastAiContent, setLastAiContent] = useState<string | null>(null);
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [seoFaqs, setSeoFaqs] = useState<string[]>([]);
  const actionTimeout = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  const statusOptions = useMemo(
    () => (role === "writer" ? postStatusValues.filter((status) => status !== "PUBLISHED") : postStatusValues),
    [role],
  );

  const canPublish = role !== "writer";
  const aiAvailable = aiEnabled && role !== "writer";
  const primaryLabel = canPublish ? (post.status === "PUBLISHED" ? "Update post" : "Publish") : "Save draft";
  const isPrimarySaving = actionState === "saving";
  const primaryVariant = actionState === "error" ? "destructive" : "default";
  const selectionText = useMemo(() => {
    const contentValue = post.contentMdx;
    const start = Math.max(0, Math.min(selectionRange.start, contentValue.length));
    const end = Math.max(0, Math.min(selectionRange.end, contentValue.length));
    if (end <= start) {
      return "";
    }
    return contentValue.slice(start, end);
  }, [post.contentMdx, selectionRange]);
  const hasSelection = selectionText.length > 0;
  useEffect(() => {
    return () => {
      if (actionTimeout.current) {
        clearTimeout(actionTimeout.current);
      }
    };
  }, []);

  const handleContentSelection = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    setSelectionRange({ start: target.selectionStart ?? 0, end: target.selectionEnd ?? 0 });
  };

  function focusContent() {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  }

  function applyGeneratedContent(mode: "replace-selection" | "append" | "insert" | "replace-all", generated: string) {
    const current = latestState.current.contentMdx;
    const start = Math.max(0, Math.min(selectionRange.start, current.length));
    const end = Math.max(0, Math.min(selectionRange.end, current.length));
    let next = current;
    if (mode === "replace-selection") {
      if (end > start) {
        next = `${current.slice(0, start)}${generated}\n${current.slice(end)}`;
      } else {
        next = generated;
      }
    } else if (mode === "append") {
      next = `${current.trimEnd()}\n\n${generated}`;
    } else if (mode === "insert") {
      next = `${current.slice(0, start)}${generated}${current.slice(start)}`;
    } else if (mode === "replace-all") {
      next = generated;
    }
    setLastAiContent(current);
    updateField("contentMdx", next);
    setSelectionRange({ start: next.length, end: next.length });
    handleSwitchView("write");
    focusContent();
  }

  function applyToneSuggestions(next: string) {
    const current = latestState.current.contentMdx;
    setLastAiContent(current);
    updateField("contentMdx", next);
    setSelectionRange({ start: next.length, end: next.length });
    focusContent();
  }

  function applySeoSuggestion(payload: { title: string; summary: string; slug: string }) {
    updateField("title", payload.title);
    updateField("summary", payload.summary);
    updateField("slug", slugify(payload.slug));
  }

  function handleSeoKeywords(keywords: string[], faqs: string[]) {
    setSeoKeywords(keywords);
    setSeoFaqs(faqs);
  }

  function insertOutline(mdx: string) {
    if (!mdx.trim()) {
      return;
    }
    applyGeneratedContent("append", mdx);
  }

  function useHeadline(headline: string) {
    updateField("title", headline);
    if (!initialPost) {
      updateField("slug", slugify(headline));
    }
  }

  function revertLastAiChange() {
    if (lastAiContent === null) {
      return;
    }
    updateField("contentMdx", lastAiContent);
    setLastAiContent(null);
    focusContent();
  }

  async function handlePrimaryAction() {
    if (isPrimarySaving) {
      return;
    }

    if (actionTimeout.current) {
      clearTimeout(actionTimeout.current);
    }

    cancelAutosave();

    const previous = latestState.current;
    const desiredStatus = canPublish ? "PUBLISHED" : "DRAFT";
    const nextState: EditorPost = {
      ...previous,
      status: desiredStatus,
      publishedAt:
        desiredStatus === "PUBLISHED"
          ? previous.publishedAt ?? new Date().toISOString()
          : null,
    };

    latestState.current = nextState;
    setPost(nextState);
    setAutosaveState("idle");
    setActionState("saving");

    try {
      const saved = await persistChanges();
      if (!saved) {
        throw new Error("Unable to save post");
      }
      setActionState("success");
      actionTimeout.current = setTimeout(() => setActionState("idle"), 2000);
    } catch (error) {
      console.error("Primary action failed", error);
      latestState.current = previous;
      setPost(previous);
      setActionState("error");
      setAutosaveState("error");
      actionTimeout.current = setTimeout(() => setActionState("idle"), 4000);
    }
  }

  function handleTagsChange(value: string) {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    updateField("tags", tags);
  }

  async function handleDelete() {
    if (!initialPost?.id) return;

    setActionState("saving");

    try {
      const response = await fetch(`/api/admin/posts/${initialPost.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete post");
      }

      clearPersistedDraft();
      router.push("/admin/posts");
      router.refresh();
    } catch (error) {
      console.error("Delete failed", error);
      setActionState("error");
      setAutosaveState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3">
        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">Draft tersimpan otomatis</p>
          <p className="text-xs text-muted-foreground">{autosaveDescription}</p>
        </div>
      </div>

      {pendingRestore ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium">Draf lokal ditemukan</p>
          <p className="mt-1 text-xs">
            Versi ini tersimpan pada {" "}
            {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(pendingRestore.autosavedAt),
            )}
            . Pulihkan untuk melanjutkan dari titik terakhir.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRestoreDraft}>
              Pulihkan draft
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscardDraft}>
              Abaikan
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "edit" ? "Edit post" : "Create a new post"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeView === "write" ? "default" : "outline"}
              onClick={() => handleSwitchView("write")}
            >
              Write
            </Button>
            <Button
              type="button"
              variant={activeView === "preview" ? "default" : "outline"}
              onClick={() => handleSwitchView("preview")}
            >
              Preview
            </Button>
          </div>
          <Button
            type="button"
            variant={primaryVariant}
            onClick={() => void handlePrimaryAction()}
            disabled={isPrimarySaving}
          >
            {isPrimarySaving ? "Saving…" : primaryLabel}
          </Button>
          {mode === "edit" && initialPost?.id ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to delete this post?")) {
                  void handleDelete();
                }
              }}
              disabled={actionState === "saving"}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="A compelling headline"
              value={post.title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                updateField("title", nextTitle);
                if (!initialPost && !post.slug) {
                  updateField("slug", slugify(nextTitle));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="custom-slug"
              value={post.slug}
              onChange={(event) => updateField("slug", slugify(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              name="summary"
              placeholder="A short elevator pitch for search and social media."
              value={post.summary}
              onChange={(event) => updateField("summary", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            {activeView === "write" ? (
              <Textarea
                id="content"
                name="content"
                ref={contentRef}
                value={post.contentMdx}
                className="min-h-[360px] font-mono"
                onChange={(event) => {
                  updateField("contentMdx", event.target.value);
                  setSelectionRange({
                    start: event.target.selectionStart ?? event.target.value.length,
                    end: event.target.selectionEnd ?? event.target.value.length,
                  });
                }}
                onSelect={handleContentSelection}
                onKeyUp={handleContentSelection}
                onClick={handleContentSelection}
              />
            ) : (
              <div className="prose prose-neutral min-h-[360px] rounded-lg border border-border bg-muted/40 p-6 text-sm dark:prose-invert">
                {previewError ? (
                  <p className="text-red-500">{previewError}</p>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                )}
              </div>
            )}
          </div>
        </div>
        <aside className="space-y-6">
          <AssistantPanel
            disabled={!aiAvailable}
            postId={post.id}
            title={post.title}
            summary={post.summary}
            tags={post.tags}
            content={post.contentMdx}
            selection={{ text: selectionText, hasSelection }}
            onApply={applyGeneratedContent}
          />
          <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              {lastAiContent ? "Latest AI edit stored for undo." : "AI edits will keep MDX intact."}
            </span>
            {lastAiContent ? (
              <Button type="button" size="sm" variant="ghost" onClick={revertLastAiChange}>
                Undo AI insert
              </Button>
            ) : null}
          </div>
          <ToneStylePanel disabled={!aiAvailable} postId={post.id} content={post.contentMdx} onApply={applyToneSuggestions} />
          <SeoOptimizerPanel
            disabled={!aiAvailable}
            postId={post.id}
            title={post.title}
            summary={post.summary}
            slug={post.slug}
            content={post.contentMdx}
            onApply={applySeoSuggestion}
            onKeywords={handleSeoKeywords}
          />
          <OutlineHeadlinePanel
            disabled={!aiAvailable}
            postId={post.id}
            title={post.title}
            summary={post.summary}
            tags={post.tags}
            onOutline={insertOutline}
            onHeadline={useHeadline}
          />
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={post.status}
              onChange={(event) => updateField("status", event.target.value as PostStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="coverUrl">Cover image URL</Label>
              <Button type="button" variant="outline" size="sm" onClick={openFileDialog}>
                Upload
              </Button>
            </div>
            <Input
              id="coverUrl"
              name="coverUrl"
              placeholder="https://"
              value={post.coverUrl}
              onChange={(event) => updateField("coverUrl", event.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadMessage ? (
              <p className={`text-xs ${uploadState === "error" ? "text-red-500" : "text-muted-foreground"}`}>
                {uploadMessage}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              placeholder="nextjs, typescript"
              value={post.tags.join(", ")}
              onChange={(event) => handleTagsChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas. They will be created automatically if they do not exist.
            </p>
            {seoKeywords.length ? (
              <div className="space-y-1 rounded-md border border-dashed border-border bg-muted/20 p-2 text-[11px]">
                <p className="font-medium">SEO keyword suggestions</p>
                <div className="flex flex-wrap gap-1">
                  {seoKeywords.map((keyword) => (
                    <span key={keyword} className="rounded bg-background px-2 py-0.5">
                      {keyword}
                    </span>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => updateField("tags", Array.from(new Set([...post.tags, ...seoKeywords])))}
                >
                  Apply keywords as tags
                </Button>
              </div>
            ) : null}
            {seoFaqs.length ? (
              <div className="space-y-1 rounded-md border border-dashed border-border bg-muted/20 p-2 text-[11px]">
                <p className="font-medium">Suggested FAQs</p>
                <ul className="list-disc space-y-1 pl-4">
                  {seoFaqs.map((faq, index) => (
                    <li key={`${faq}-${index}`}>{faq}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishedAt">Published at</Label>
            <Input
              id="publishedAt"
              name="publishedAt"
              type="datetime-local"
              value={post.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : ""}
              onChange={(event) =>
                updateField(
                  "publishedAt",
                  event.target.value ? new Date(event.target.value).toISOString() : null,
                )
              }
            />
            <p className="text-xs text-muted-foreground">Leave blank to auto-fill when publishing.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
