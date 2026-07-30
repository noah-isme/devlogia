import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";

export async function GET() {
  let posts: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  try {
    const prismaModule = await import("@/lib/prisma");
    const { isDatabaseEnabled, safeFindMany } = prismaModule;

    if (isDatabaseEnabled) {
      posts = await safeFindMany("post", {
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 30,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }
  } catch (err) {
    console.error("Failed to fetch Atom feed posts", err);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url || "http://localhost:3001";

  const entries = posts
    .map((post) => {
      const updated = (post.updatedAt ?? post.publishedAt ?? post.createdAt).toISOString();
      const published = (post.publishedAt ?? post.createdAt).toISOString();
      const link = `${baseUrl}/blog/${post.slug}`;

      return `
    <entry>
      <title>${escapeXml(post.title)}</title>
      <link href="${link}"/>
      <id>${link}</id>
      <updated>${updated}</updated>
      <published>${published}</published>
      <summary>${escapeXml(post.summary || post.title)}</summary>
    </entry>`;
    })
    .join("");

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteConfig.name)} Blog</title>
  <subtitle>${escapeXml(siteConfig.description)}</subtitle>
  <link href="${baseUrl}/feed.xml" rel="self"/>
  <link href="${baseUrl}/blog"/>
  <id>${baseUrl}/blog</id>
  <updated>${new Date().toISOString()}</updated>
  ${entries}
</feed>`;

  return new NextResponse(atomXml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=18000, stale-while-revalidate=86400",
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
