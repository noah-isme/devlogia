import { NextResponse } from "next/server";

import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/seo";

function escapeCdata(value: string) {
  return value.replaceAll("]]>", "]]>]]><![CDATA[");
}

export async function GET() {
  if (!isDatabaseEnabled) {
    return buildRssResponse([]);
  }

  let posts: Array<{
    title: string;
    slug: string;
    summary: string | null;
    contentMdx: string;
    publishedAt: Date | null;
    updatedAt: Date;
  }> = [];

  try {
    posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        title: true,
        slug: true,
        summary: true,
        contentMdx: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    console.error("Failed to generate RSS feed", error);
  }

  return buildRssResponse(posts);
}

function buildRssResponse(
  posts: Array<{
    title: string;
    slug: string;
    summary: string | null;
    contentMdx: string;
    publishedAt: Date | null;
    updatedAt: Date;
  }>,
) {
  const items = posts
    .map((post) => {
      const url = `${siteConfig.url}/blog/${post.slug}`;
      const pubDate = post.publishedAt ?? post.updatedAt;
      const content = escapeCdata(post.contentMdx);
      return `<item>
  <title><![CDATA[${post.title}]]></title>
  <link>${url}</link>
  <guid>${url}</guid>
  <pubDate>${pubDate.toUTCString()}</pubDate>
  <description><![CDATA[${post.summary ?? ""}]]></description>
  <content:encoded><![CDATA[${content}]]></content:encoded>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${siteConfig.name}]]></title>
    <link>${siteConfig.url}</link>
    <description><![CDATA[${siteConfig.description}]]></description>
    <language>en</language>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600",
    },
  });
}
