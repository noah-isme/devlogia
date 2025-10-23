import { z } from "zod";

export const postStatusValues = ["DRAFT", "PUBLISHED", "SCHEDULED"] as const;

export const upsertPostSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(180),
  slug: z
    .string()
    .trim()
    .min(3, "Slug is required")
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  summary: z.string().trim().max(320).optional().nullable(),
  contentMdx: z.string().min(1, "Content cannot be empty"),
  coverUrl: z
    .string()
    .url("Cover must be a valid URL")
    .optional()
    .or(z.literal("").transform(() => undefined))
    .nullable(),
  status: z.enum(postStatusValues),
  publishedAt: z
    .string()
    .datetime({ message: "Invalid date" })
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});

export const createPostSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    summary: z.string().trim().max(320).optional(),
    contentMdx: z.string().optional(),
    coverUrl: z
      .string()
      .url("Cover must be a valid URL")
      .optional()
      .or(z.literal(""))
      .nullable(),
    status: z.enum(postStatusValues).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(150)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    publishedAt: z
      .string()
      .datetime({ message: "Invalid date" })
      .optional()
      .nullable(),
  })
  .optional();
