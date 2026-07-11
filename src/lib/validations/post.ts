import { z } from "zod";

export const postStatusValues = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;
export const revisionReasonValues = ["autosave", "manual", "publish"] as const;

const optionalSummarySchema = z.string().trim().max(320).optional().nullable();

function isValidCoverUrl(value: string) {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const optionalCoverUrlSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }

    return value;
  },
  z
    .string()
    .trim()
    .refine(isValidCoverUrl, "Cover must be a valid URL")
    .optional()
    .nullable(),
);

export const upsertPostSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(180),
  slug: z
    .string()
    .trim()
    .min(3, "Slug is required")
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  summary: optionalSummarySchema,
  contentMdx: z.string().min(1, "Content cannot be empty"),
  coverUrl: optionalCoverUrlSchema,
  status: z.enum(postStatusValues),
  publishedAt: z
    .string()
    .pipe(z.iso.datetime({ message: "Invalid date" }))
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  revisionReason: z.enum(revisionReasonValues).optional(),
  expectedUpdatedAt: z.iso.datetime({ message: "Invalid date" }).optional().nullable(),
});

export const createPostSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    summary: optionalSummarySchema,
    contentMdx: z.string().optional(),
    coverUrl: optionalCoverUrlSchema,
    status: z.enum(postStatusValues).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(150)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    revisionReason: z.enum(revisionReasonValues).optional(),
    publishedAt: z
      .string()
      .pipe(z.iso.datetime({ message: "Invalid date" }))
      .optional()
      .nullable(),
  })
  .optional();
