import { NextResponse } from "next/server";
import { z } from "zod";

import { calculateAudioMetadata } from "@/lib/tts/cleaner";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";

const ttsSchema = z.object({
  postId: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  contentMdx: z.string().optional(),
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = ttsSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { postId, slug } = parsed.data;
  let { title, contentMdx } = parsed.data;

  if ((postId || slug) && isDatabaseEnabled) {
    try {
      const post = await prisma.post.findFirst({
        where: postId ? { id: postId, status: "PUBLISHED" } : { slug: slug, status: "PUBLISHED" },
      });
      if (post) {
        title = post.title;
        contentMdx = post.contentMdx;
      }
    } catch (error) {
      console.warn("Failed to fetch post for TTS from DB", error);
    }
  }

  if (!title || !contentMdx) {
    return NextResponse.json({ error: "Missing post title or content" }, { status: 400 });
  }

  const metadata = calculateAudioMetadata(title, contentMdx);

  return NextResponse.json(metadata);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("postId");
  const slug = searchParams.get("slug");

  if (!postId && !slug) {
    return NextResponse.json({ error: "Specify postId or slug parameter" }, { status: 400 });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const post = await prisma.post.findFirst({
      where: postId ? { id: postId, status: "PUBLISHED" } : { slug: slug!, status: "PUBLISHED" },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const metadata = calculateAudioMetadata(post.title, post.contentMdx);
    return NextResponse.json(metadata);
  } catch (error) {
    console.error("TTS fetch error", error);
    return NextResponse.json({ error: "Failed to load narration" }, { status: 500 });
  }
}
