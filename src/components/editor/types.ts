import { postStatusValues } from "@/lib/validations/post";

export type PostStatus = (typeof postStatusValues)[number];

export type EditorPost = {
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

export type PersistedDraft = {
  snapshot: EditorPost;
  autosavedAt: string;
};

export type AutosaveState = "idle" | "saving" | "saved" | "error";
export type UploadState = "idle" | "uploading" | "success" | "error";
