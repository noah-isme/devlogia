"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
};

type PostEditorProps = {
  initialPost?: EditorPost;
  mode: "create" | "edit";
};

type AutosaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY = 1500;

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
    },
  );
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const latestState = useRef(post);
  const lastSavedSnapshot = useRef<string>("");
  const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);

  const localStorageKey = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const id = post.id ?? "new";
    return `devlogia-editor-${id}`;
  }, [post.id]);

  useEffect(() => {
    latestState.current = post;
  }, [post]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let snapshot: EditorPost | null = null;

    if (!initialPost) {
      const persisted = window.localStorage.getItem("devlogia-editor-new");
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as EditorPost;
          setPost(parsed);
          snapshot = parsed;
        } catch (error) {
          console.error("Failed to parse persisted draft", error);
        }
      }
    } else {
      const persisted = window.localStorage.getItem(`devlogia-editor-${initialPost.id}`);
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as EditorPost;
          setPost(parsed);
          snapshot = parsed;
        } catch (error) {
          console.error("Failed to parse persisted draft", error);
        }
      }
    }

    const reference = snapshot ?? latestState.current;
    lastSavedSnapshot.current = JSON.stringify({ ...reference, lastSavedAt: undefined });

    setIsInitializing(false);
  }, [initialPost]);

  useEffect(() => {
    if (typeof window === "undefined" || !localStorageKey) {
      return;
    }

    window.localStorage.setItem(localStorageKey, JSON.stringify(latestState.current));

    if (mode === "create" && post.id && localStorageKey !== "devlogia-editor-new") {
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

    const snapshot = JSON.stringify({ ...post, lastSavedAt: undefined });
    if (snapshot === lastSavedSnapshot.current) {
      return;
    }

    autosaveTimeout.current = setTimeout(async () => {
      try {
        await persistChanges();
        lastSavedSnapshot.current = JSON.stringify({ ...latestState.current, lastSavedAt: undefined });
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
      return;
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
      return;
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
    };

    setPost(updated);
    setAutosaveState("saved");
    setLastSavedAt(new Date());
  }

  const autosaveLabel = useMemo(() => {
    switch (autosaveState) {
      case "saving":
        return "Saving…";
      case "saved":
        return lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Saved";
      case "error":
        return "Offline — saved locally";
      default:
        return "Idle";
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
  }

  function handleTagsChange(value: string) {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    updateField("tags", tags);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "edit" ? "Edit post" : "Create a new post"}
          </h1>
          <p className="text-sm text-muted-foreground">{autosaveLabel}</p>
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
            <Label htmlFor="coverUrl">Cover image URL</Label>
            <Input
              id="coverUrl"
              name="coverUrl"
              placeholder="https://"
              value={post.coverUrl}
              onChange={(event) => updateField("coverUrl", event.target.value)}
            />
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
              onChange={(event) => updateField("publishedAt", event.target.value ? new Date(event.target.value).toISOString() : null)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-fill when publishing.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
