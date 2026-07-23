import { postStatusValues } from "@/lib/validations/post";

export type PostStatus = (typeof postStatusValues)[number];

export type EditorPost = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  contentMdx: string;
  coverUrl: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  status: PostStatus;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
};

export type PersistedDraft = {
  snapshot: EditorPost;
  autosavedAt: string;
};

export type EditorConflict = {
  readonly serverPost: EditorPost;
  readonly message: string;
};

export type EditorRevision = {
  readonly id: string;
  readonly reason: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly contentMdx?: string;
  readonly status: PostStatus;
  readonly createdAt: string;
};

export type AutosaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type UploadState = "idle" | "uploading" | "success" | "error";
