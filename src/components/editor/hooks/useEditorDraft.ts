import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { slugify } from "@/lib/utils";
import type { AutosaveState, EditorConflict, EditorPost, PersistedDraft } from "@/components/editor/types";

const AUTOSAVE_DELAY = 1500;

function serialize(post: EditorPost) {
  return JSON.stringify(post);
}

function serializeEditableFields(post: EditorPost) {
  return JSON.stringify({
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    contentMdx: post.contentMdx,
    coverUrl: post.coverUrl,
    status: post.status,
    tags: post.tags,
    publishedAt: post.publishedAt,
  });
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

function getTagName(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object" || value === null || !("tag" in value)) {
    return "";
  }

  const tag = value.tag;
  if (typeof tag !== "object" || tag === null || !("name" in tag)) {
    return "";
  }

  return typeof tag.name === "string" ? tag.name : "";
}

function normalizeEditorPost(received: Partial<EditorPost> & { tags?: unknown }, fallbackTags: string[]): EditorPost {
  return {
    id: received.id ?? null,
    title: received.title ?? "Untitled draft",
    slug: received.slug ?? "untitled",
    summary: received.summary ?? "",
    contentMdx: received.contentMdx ?? "",
    coverUrl: received.coverUrl ?? "",
    status: received.status ?? "DRAFT",
    tags: Array.isArray(received.tags) ? received.tags.map(getTagName).filter(Boolean) : fallbackTags,
    publishedAt: received.publishedAt ?? null,
    updatedAt: received.updatedAt ?? new Date().toISOString(),
  };
}

type UseEditorDraftOptions = {
  initialPost?: EditorPost;
  mode: "create" | "edit";
};

export function useEditorDraft({ initialPost, mode }: UseEditorDraftOptions) {
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingRestore, setPendingRestore] = useState<PersistedDraft | null>(null);
  const [conflict, setConflict] = useState<EditorConflict | null>(null);

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
        if (serializeEditableFields(normalized.snapshot) !== serializeEditableFields(initialPost)) {
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

  const autosaveDescription = useMemo(() => {
    switch (autosaveState) {
      case "saving":
        return "Menyimpan perubahan…";
      case "saved":
        return `Terakhir disimpan pukul ${formatTime(lastSavedAt)}`;
      case "error":
        return "Tidak tersambung — versi lokal disimpan.";
      case "conflict":
        return "Post changed in another tab — review before saving again.";
      default:
        return "Perubahan akan tersimpan otomatis.";
    }
  }, [autosaveState, lastSavedAt]);

  const persistChanges = useCallback(async (revisionReason: "autosave" | "manual" = "autosave") => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setAutosaveState("error");
      return null;
    }

    setAutosaveState("saving");

    const submitted = latestState.current;
    const submittedSnapshot = serializeEditableFields(submitted);
    const payload = {
      title: submitted.title || "Untitled draft",
      slug: submitted.slug || slugify(submitted.title || "untitled"),
      summary: submitted.summary || null,
      contentMdx:
        submitted.contentMdx ||
        "# Start writing\n\nUse markdown and MDX components like <Callout>Note</Callout>.",
      coverUrl: submitted.coverUrl || null,
      status: submitted.status,
      tags: submitted.tags,
      publishedAt: submitted.publishedAt,
      revisionReason,
      expectedUpdatedAt: submitted.updatedAt,
    };

    const endpoint = submitted.id
      ? `/api/admin/posts/${submitted.id}`
      : "/api/admin/posts";
    const method = submitted.id ? "PATCH" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 409) {
        const data = await response.json();
        const received = data.post;
        setConflict({
          message: typeof data.error === "string" ? data.error : "Post changed in another tab.",
          serverPost: normalizeEditorPost(received, latestState.current.tags),
        });
        setAutosaveState("conflict");
        return null;
      }
      setAutosaveState("error");
      throw new Error(`Failed to persist post: ${response.status}`);
    }

    const data = await response.json();
    const received = data.post;

    if (serializeEditableFields(latestState.current) !== submittedSnapshot) {
      const merged: EditorPost = {
        ...latestState.current,
        id: received.id,
        updatedAt: received.updatedAt ?? latestState.current.updatedAt,
      };
      setPost(merged);
      latestState.current = merged;
      setPendingRestore(null);
      setAutosaveState("idle");
      return null;
    }

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
    setConflict(null);

    const savedAt = updated.updatedAt ? new Date(updated.updatedAt) : new Date();
    setLastSavedAt(savedAt);
    setAutosaveState("saved");

    return updated;
  }, [setAutosaveState, setLastSavedAt, setPendingRestore, setPost]);

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
  }, [persistChanges, post, isInitializing]);

  useEffect(() => {
    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, []);

  function updateField<K extends keyof EditorPost>(key: K, value: EditorPost[K]) {
    setPost((prev) => {
      const next = { ...prev, [key]: value };
      latestState.current = next;
      return next;
    });
    if (!conflict) {
      setAutosaveState("idle");
    }
  }

  function handleUseServerVersion() {
    if (!conflict) return;

    setPost(conflict.serverPost);
    latestState.current = conflict.serverPost;
    setLastSavedAt(conflict.serverPost.updatedAt ? new Date(conflict.serverPost.updatedAt) : new Date());
    lastSavedSnapshot.current = serialize(conflict.serverPost);
    setConflict(null);
    setAutosaveState("saved");
  }

  function handleKeepLocalVersion() {
    setConflict(null);
    setAutosaveState("idle");
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

  function clearPersistedDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(initialStorageKey);
    }
  }

  function cancelAutosave() {
    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }
  }

  return {
    post,
    setPost,
    latestState,
    updateField,
    autosaveState,
    setAutosaveState,
    autosaveDescription,
    pendingRestore,
    handleRestoreDraft,
    handleDiscardDraft,
    conflict,
    handleUseServerVersion,
    handleKeepLocalVersion,
    persistChanges,
    cancelAutosave,
    clearPersistedDraft,
  };
}
