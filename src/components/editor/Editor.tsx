"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
};

type AutosaveState = "idle" | "saving" | "saved" | "error";
type UploadState = "idle" | "uploading" | "success" | "error";

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

export function PostEditor({ initialPost, mode }: PostEditorProps) {
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestState = useRef(post);
  const lastSavedSnapshot = useRef<string>(serialize(post));
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);

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

  function updateField<K extends keyof EditorPost>(key: K, value: EditorPost[K]) {
    setPost((prev) => ({ ...prev, [key]: value }));
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

      setPost((prev) => ({
        ...prev,
        coverUrl: uploaded.url,
        contentMdx: `${prev.contentMdx.trimEnd()}\n\n![${alt}](${uploaded.url})\n`,
      }));
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
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={post.status}
              onChange={(event) => updateField("status", event.target.value as PostStatus)}
            >
              {postStatusValues.map((status) => (
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

