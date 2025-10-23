import { z } from "zod";

export const pageSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, or hyphens"),
  contentMdx: z.string().min(1),
  published: z.boolean(),
});

export type PageInput = z.infer<typeof pageSchema>;
