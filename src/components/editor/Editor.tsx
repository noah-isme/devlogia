"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/rbac";
import { postStatusValues } from "@/lib/validations/post";
import { slugify } from "@/lib/utils";

type PostStatus = (typeof postStatusValues)[number];

type EditorPost = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  contentMdx: string;
  coverUrl: string;
  status: PostStatus;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
};

type PersistedDraft = {
  snapshot: EditorPost;
  autosavedAt: string;
};

type PostEditorProps = {
  initialPost?: EditorPost;
  mode: "create" | "edit";
  role: Role;
  aiEnabled: boolean;
};

type AutosaveState = "idle" | "saving" | "saved" | "error";
type UploadState = "idle" | "uploading" | "success" | "error";

type AIEndpoint = "outline" | "meta" | "tags" | "rephrase";
type AIResult =
  | { type: "outline"; data: string[] }
  | { type: "meta"; data: { title: string; description: string } }
  | { type: "tags"; data: string[] }
  | { type: "rephrase"; data: string };

const AUTOSAVE_DELAY = 1500;

function serialize(post: EditorPost) {
  return JSON.stringify(post);
}

function formatTime(date: Date | null) {
  if (!date) {
    return "baru saja";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PostEditor({ initialPost, mode, role, aiEnabled }: PostEditorProps) {
  const [post, setPost] = useState<EditorPost>(
    initialPost ?? {
      id: null,
      title: "",
      slug: "",
      summary: "",
      contentMdx: "",
      coverUrl: "",
      status: "DRAFT",
      tags: [],
      publishedAt: null,
      updatedAt: null,
    },
  );
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialPost?.updatedAt ? new Date(initialPost.updatedAt) : null,
  );
  const [activeView, setActiveView] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingRestore, setPendingRestore] = useState<PersistedDraft | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [actionState, setActionState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestState = useRef(post);
  const lastSavedSnapshot = useRef<string>(serialize(post));
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const actionTimeout = useRef<NodeJS.Timeout | null>(null);

  const localStorageKey = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const id = post.id ?? "new";
    return `devlogia-editor-${id}`;
  }, [post.id]);

  const initialStorageKey = useMemo(
    () => (initialPost ? `devlogia-editor-${initialPost.id}` : "devlogia-editor-new"),
    [initialPost],
  );

  const statusOptions = useMemo(
    () => (role === "writer" ? postStatusValues.filter((status) => status !== "PUBLISHED") : postStatusValues),
    [role],
  );

  const canPublish = role !== "writer";
  const aiAvailable = aiEnabled && role !== "writer";
  const primaryLabel = canPublish ? (post.status === "PUBLISHED" ? "Update post" : "Publish") : "Save draft";
  const isPrimarySaving = actionState === "saving";
  const primaryVariant = actionState === "error" ? "destructive" : "default";
  const primaryActionTestId = canPublish ? "post-publish" : "post-save-draft";

  useEffect(() => {
    latestState.current = post;
  }, [post]);

  useEffect(() => {
    if (!isInitializing) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const persistedRaw = window.localStorage.getItem(initialStorageKey);
    if (!persistedRaw) {
      lastSavedSnapshot.current = serialize(post);
      setIsInitializing(false);
      return;
    }

    try {
      const parsed = JSON.parse(persistedRaw) as PersistedDraft | EditorPost;
      const snapshot = "snapshot" in parsed ? parsed.snapshot : parsed;
      const autosavedAt = "autosavedAt" in parsed ? parsed.autosavedAt : snapshot.updatedAt;
      const normalized: PersistedDraft = {
        snapshot: {
          ...snapshot,
          updatedAt: snapshot.updatedAt ?? null,
        },
        autosavedAt: autosavedAt ?? new Date().toISOString(),
      };

      if (!initialPost) {
        setPendingRestore(normalized);
      } else {
        const serverUpdatedAt = initialPost.updatedAt ? new Date(initialPost.updatedAt).getTime() : null;
        const localUpdatedAt = new Date(normalized.autosavedAt).getTime();
        if (!serverUpdatedAt || localUpdatedAt > serverUpdatedAt + 500) {
          setPendingRestore(normalized);
        }
      }
    } catch (error) {
      console.error("Failed to parse persisted draft", error);
      window.localStorage.removeItem(initialStorageKey);
    } finally {
      setIsInitializing(false);
    }
  }, [initialPost, initialStorageKey, isInitializing, post]);

  useEffect(() => {
    if (typeof window === "undefined" || !localStorageKey) {
      return;
    }

    const persisted: PersistedDraft = {
      snapshot: latestState.current,
      autosavedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(localStorageKey, JSON.stringify(persisted));

    if (mode === "create" && latestState.current.id && localStorageKey !== "devlogia-editor-new") {
      window.localStorage.removeItem("devlogia-editor-new");
    }
  }, [localStorageKey, mode, post]);

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

    const snapshot = serialize(post);
    if (snapshot === lastSavedSnapshot.current) {
      return;
    }

    autosaveTimeout.current = setTimeout(async () => {
      try {
        const saved = await persistChanges();
        if (saved) {
          lastSavedSnapshot.current = serialize(saved);
        }
      } catch (error) {
        console.error("Autosave failed", error);
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, [post, isInitializing]);

  useEffect(() => {
    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
      if (actionTimeout.current) {
        clearTimeout(actionTimeout.current);
      }
    };
  }, []);

  async function persistChanges() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setAutosaveState("error");
      return null;
    }

    setAutosaveState("saving");

    const payload = {
      title: latestState.current.title || "Untitled draft",
      slug: latestState.current.slug || slugify(latestState.current.title || "untitled"),
      summary: latestState.current.summary || null,
      contentMdx:
        latestState.current.contentMdx ||
        "# Start writing\n\nUse markdown and MDX components like <Callout>Note</Callout>.",
      coverUrl: latestState.current.coverUrl || null,
      status: latestState.current.status,
      tags: latestState.current.tags,
      publishedAt: latestState.current.publishedAt,
    };

    const endpoint = latestState.current.id
      ? `/api/admin/posts/${latestState.current.id}`
      : "/api/admin/posts";
    const method = latestState.current.id ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setAutosaveState("error");
      throw new Error(`Failed to persist post: ${response.status}`);
    }

    const data = await response.json();
    const received = data.post;

    const updated: EditorPost = {
      id: received.id,
      title: received.title,
      slug: received.slug,
      summary: received.summary ?? "",
      contentMdx: received.contentMdx,
      coverUrl: received.coverUrl ?? "",
      status: received.status,
      tags: Array.isArray(received.tags)
        ? received.tags.map((item: { tag: { name: string } }) => item.tag.name)
        : latestState.current.tags,
      publishedAt: received.publishedAt ?? null,
      updatedAt: received.updatedAt ?? new Date().toISOString(),
    };

    setPost(updated);
    latestState.current = updated;
    setPendingRestore(null);

    const savedAt = updated.updatedAt ? new Date(updated.updatedAt) : new Date();
    setLastSavedAt(savedAt);
    setAutosaveState("saved");

    return updated;
  }

  const autosaveDescription = useMemo(() => {
    switch (autosaveState) {
      case "saving":
        return "Menyimpan perubahan…";
      case "saved":
        return `Terakhir disimpan pukul ${formatTime(lastSavedAt)}`;
      case "error":
        return "Tidak tersambung — versi lokal disimpan.";
      default:
        return "Perubahan akan tersimpan otomatis.";
    }
  }, [autosaveState, lastSavedAt]);

  async function handlePreview() {
    setPreviewError(null);
    setActiveView("preview");

    try {
      const response = await fetch("/api/mdx/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: latestState.current.contentMdx }),
      });

      if (!response.ok) {
        throw new Error("Failed to render preview");
      }

      const data = await response.json();
      setPreviewHtml(data.html ?? "");
    } catch (error) {
      console.error(error);
      setPreviewError("Unable to render preview. Check your MDX syntax.");
    }
  }

  const handleSwitchView = (view: "write" | "preview") => {
    if (view === "preview") {
      void handlePreview();
    } else {
      setActiveView("write");
    }
  };

  async function handlePrimaryAction() {
    if (isPrimarySaving) {
      return;
    }

    if (actionTimeout.current) {
      clearTimeout(actionTimeout.current);
    }

    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

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

  async function requestAI(endpoint: AIEndpoint) {
    if (!aiAvailable) {
      return;
    }

    if (endpoint !== "outline") {
      const contentLength = latestState.current.contentMdx.trim().length;
      if (contentLength < 10) {
        setAiError("Add more content before requesting AI suggestions.");
        return;
      }
    } else if (!latestState.current.title || latestState.current.title.trim().length < 3) {
      setAiError("Add a working title before requesting an outline.");
      return;
    }

    setAiStatus("loading");
    setAiError(null);
    setAiResult(null);

    const payload = (() => {
      switch (endpoint) {
        case "outline":
          return { topic: latestState.current.title || latestState.current.slug || "Draft" };
        case "meta":
          return {
            title: latestState.current.title || "Untitled draft",
            content: latestState.current.contentMdx,
          };
        case "tags":
          return { content: latestState.current.contentMdx, limit: 8 };
        case "rephrase":
          return { content: latestState.current.contentMdx };
        default:
          return {};
      }
    })();

    try {
      const response = await fetch(`/api/ai/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          response.status === 429
            ? "AI rate limit reached. Try again later."
            : response.status === 503
              ? "AI assistant is disabled for this workspace."
              : typeof body.error === "string"
                ? body.error
                : `AI request failed (${response.status}).`;
        setAiError(message);
        setAiStatus("idle");
        return;
      }

      const body = await response.json();
      const data = body.data;
      let result: AIResult | null = null;

      switch (endpoint) {
        case "outline":
          if (Array.isArray(data)) {
            result = { type: "outline", data: data.map((item: unknown) => String(item)) };
          }
          break;
        case "meta":
          if (data && typeof data === "object") {
            result = {
              type: "meta",
              data: {
                title: String((data as { title?: string }).title ?? latestState.current.title),
                description: String((data as { description?: string }).description ?? latestState.current.summary),
              },
            };
          }
          break;
        case "tags":
          if (Array.isArray(data)) {
            result = {
              type: "tags",
              data: data.map((item: unknown) => String(item)).filter(Boolean),
            };
          }
          break;
        case "rephrase":
          if (typeof data === "string") {
            result = { type: "rephrase", data };
          }
          break;
        default:
          break;
      }

      if (!result) {
        setAiError("AI response was empty. Try again.");
        setAiStatus("idle");
        return;
      }

      setAiResult(result);
      setAiStatus("idle");
    } catch (error) {
      console.error("AI request failed", error);
      setAiError("Unable to reach the AI assistant.");
      setAiStatus("idle");
    }
  }

  function applyAiResult(result: AIResult) {
    switch (result.type) {
      case "outline": {
        const outline = result.data
          .map((item) => `## ${item}`)
          .join("\n\n");
        const existing = latestState.current.contentMdx.trim();
        const next = `${existing ? `${existing}\n\n` : ""}${outline}`;
        updateField("contentMdx", next);
        setActiveView("write");
        break;
      }
      case "meta": {
        updateField("title", result.data.title);
        updateField("summary", result.data.description);
        break;
      }
      case "tags": {
        const uniqueTags = Array.from(new Set(result.data.map((tag) => tag.trim()).filter(Boolean)));
        updateField("tags", uniqueTags);
        break;
      }
      case "rephrase": {
        updateField("contentMdx", result.data);
        setActiveView("write");
        break;
      }
      default:
        break;
    }

    setAiResult(null);
    setAiError(null);
  }

  function updateField<K extends keyof EditorPost>(key: K, value: EditorPost[K]) {
    setPost((prev) => {
      const next = { ...prev, [key]: value };
      latestState.current = next;
      return next;
    });
    setAutosaveState("idle");
  }

  function handleTagsChange(value: string) {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    updateField("tags", tags);
  }

  function handleRestoreDraft() {
    if (!pendingRestore) return;

    setPost(pendingRestore.snapshot);
    latestState.current = pendingRestore.snapshot;
    setLastSavedAt(new Date(pendingRestore.autosavedAt));
    lastSavedSnapshot.current = serialize(pendingRestore.snapshot);
    setPendingRestore(null);
    setAutosaveState("idle");
  }

  function handleDiscardDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(initialStorageKey);
    }
    setPendingRestore(null);
  }

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setUploadState("error");
      setUploadMessage("Tidak dapat mengunggah saat offline.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadState("uploading");
    setUploadMessage(null);

    try {
      const response = await fetch("/api/uploadthing", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const uploaded = data.files?.[0];

      if (!uploaded?.url) {
        throw new Error("Upload response missing URL");
      }

      const fallbackAlt = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      const alt = uploaded.alt ?? (fallbackAlt || "Image");

      setPost((prev) => {
        const next = {
          ...prev,
          coverUrl: uploaded.url,
          contentMdx: `${prev.contentMdx.trimEnd()}\n\n![${alt}](${uploaded.url})\n`,
        };
        latestState.current = next;
        return next;
      });
      setAutosaveState("idle");
      setUploadState("success");
      setUploadMessage("Gambar diunggah. Cover diperbarui dan markdown disisipkan.");
    } catch (error) {
      console.error("Upload failed", error);
      setUploadState("error");
      setUploadMessage("Gagal mengunggah gambar stub.");
    }
  }

  return (
    <div className="space-y-6" data-testid="post-editor">
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
          <h1
            className="text-2xl font-semibold tracking-tight"
            data-testid="post-editor-heading"
          >
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
            data-testid={primaryActionTestId}
          >
            {isPrimarySaving ? "Saving…" : primaryLabel}
          </Button>
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
                value={post.contentMdx}
                className="min-h-[360px] font-mono"
                onChange={(event) => updateField("contentMdx", event.target.value)}
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
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">AI Assist</h2>
              <span className="text-xs text-muted-foreground">
                {!aiAvailable ? "Disabled" : aiStatus === "loading" ? "Generating…" : "Beta"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate outlines, SEO metadata, tags, or rephrase existing content to speed up your workflow.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!aiAvailable || aiStatus === "loading"}
                onClick={() => void requestAI("outline")}
              >
                Outline
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!aiAvailable || aiStatus === "loading"}
                onClick={() => void requestAI("meta")}
              >
                Meta
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!aiAvailable || aiStatus === "loading"}
                onClick={() => void requestAI("tags")}
              >
                Tags
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!aiAvailable || aiStatus === "loading"}
                onClick={() => void requestAI("rephrase")}
              >
                Rephrase
              </Button>
            </div>
            {aiError ? <p className="text-xs text-red-500">{aiError}</p> : null}
            {aiResult ? (
              <div className="space-y-3 rounded-md border border-dashed border-border bg-background p-3 text-xs">
                {aiResult.type === "outline" ? (
                  <ul className="list-disc space-y-1 pl-4 text-left">
                    {aiResult.data.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : aiResult.type === "meta" ? (
                  <div className="space-y-1 text-left">
                    <p>
                      <span className="font-medium">Title:</span> {aiResult.data.title}
                    </p>
                    <p>
                      <span className="font-medium">Description:</span> {aiResult.data.description}
                    </p>
                  </div>
                ) : aiResult.type === "tags" ? (
                  <div className="flex flex-wrap gap-2">
                    {aiResult.data.map((tag) => (
                      <Badge key={tag} variant="info">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-left">
                    {aiResult.data}
                  </pre>
                )}
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => applyAiResult(aiResult)}>
                    Apply
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAiResult(null)}>
                    Clear
                  </Button>
                </div>
              </div>
            ) : null}
            {!aiAvailable ? (
              <p className="text-xs text-muted-foreground">
                Configure <code>AI_PROVIDER</code> to enable AI assistance.
              </p>
            ) : null}
          </div>
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
              <p
                className={`text-xs ${
                  uploadState === "error" ? "text-red-500" : "text-muted-foreground"
                }`}
              >
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

