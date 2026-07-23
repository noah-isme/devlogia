import { NextResponse } from "next/server";
import { z } from "zod";

import { translateMdxDocument, type SupportedLanguageCode } from "@/lib/ai/mdx-translator";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";

const publicRequestSchema = z.object({
  postId: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  contentMdx: z.string().optional(),
  targetLanguage: z.enum(["id", "es", "fr", "de", "ja", "zh", "en"] satisfies SupportedLanguageCode[]),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = publicRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { postId, slug, targetLanguage } = parsed.data;
  let { title, summary, contentMdx } = parsed.data;

  // If postId or slug was provided, fetch post from database if available
  if ((postId || slug) && isDatabaseEnabled) {
    try {
      const post = await prisma.post.findFirst({
        where: postId ? { id: postId, status: "PUBLISHED" } : { slug: slug, status: "PUBLISHED" },
      });
      if (post) {
        title = post.title;
        summary = post.summary ?? "";
        contentMdx = post.contentMdx;
      }
    } catch (error) {
      console.warn("Failed to fetch post for translation from DB", error);
    }
  }

  if (!title || !contentMdx) {
    return NextResponse.json({ error: "Missing post title or content" }, { status: 400 });
  }

  try {
    const translation = await translateMdxDocument({
      title,
      summary,
      contentMdx,
      targetLanguage,
    });

    return NextResponse.json({
      title: translation.title,
      summary: translation.summary,
      contentMdx: translation.contentMdx,
      targetLanguage: translation.targetLanguage,
      languageName: translation.languageName,
    });
  } catch (error) {
    console.error("Public post translation failed", error);
    return NextResponse.json({ error: "Failed to translate article" }, { status: 500 });
  }
}
