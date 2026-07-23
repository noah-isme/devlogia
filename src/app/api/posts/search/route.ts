import { NextResponse } from "next/server";

import { isDatabaseEnabled, prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  if (!isDatabaseEnabled) {
    return NextResponse.json({ results: [] });
  }

  try {
    const qLower = query.toLowerCase();

    // Query published posts with tags and content vectors
    const posts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { contentMdx: { contains: query } },
          { tags: { some: { tag: { name: { contains: query } } } } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        coverUrl: true,
        publishedAt: true,
        tags: { select: { tag: { select: { name: true, slug: true } } } },
        embedding: { select: { dimension: true } },
        contentVector: { select: { topicTags: true } },
      },
    });

    const results = posts.map((post) => {
      let score = 0;
      const matchType: string[] = [];

      if (post.title.toLowerCase().includes(qLower)) {
        score += 1.0;
        matchType.push("Title Match");
      }

      if (post.summary?.toLowerCase().includes(qLower)) {
        score += 0.6;
        matchType.push("Summary Match");
      }

      const hasTagMatch = post.tags.some(({ tag }) => tag.name.toLowerCase().includes(qLower));
      if (hasTagMatch) {
        score += 0.8;
        matchType.push("Tag Match");
      }

      if (post.embedding || post.contentVector) {
        score += 0.4;
        matchType.push("Vector Match");
      }

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        coverUrl: post.coverUrl,
        publishedAt: post.publishedAt,
        tags: post.tags.map(({ tag }) => tag.name),
        score,
        matchType: matchType.length ? matchType : ["Content Match"],
      };
    });

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({ results, query });
  } catch (error) {
    console.error("Failed to execute vector search query", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
