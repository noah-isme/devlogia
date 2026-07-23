import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";

export async function GET() {
  let posts: Array<{
    slug: string;
    title: string;
    summary: string | null;
    contentMdx: string;
    publishedAt: Date | null;
    createdAt: Date;
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
          slug: true,
          title: true,
          summary: true,
          contentMdx: true,
          publishedAt: true,
          createdAt: true,
        },
      });
    }
  } catch (err) {
    console.error("Failed to fetch RSS posts", err);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url || "http://localhost:3000";

  const rssItems = posts
    .map((post) => {
      const pubDate = (post.publishedAt ?? post.createdAt).toUTCString();
      const link = `${baseUrl}/blog/${post.slug}`;
      const description = escapeXml(post.summary || post.title);

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
    })
    .join("");

  const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.name)} - Devlogia Blog</title>
    <link>${baseUrl}/blog</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
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
