import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  isRateLimitBypassed,
  parseRateLimit,
  resolveRateLimitKey,
} from "@/lib/ratelimit";

const rssRateLimit = parseRateLimit(process.env.RSS_RATE_LIMIT, 60);
const rssRateWindow = parseRateLimit(process.env.RSS_RATE_LIMIT_WINDOW_MS, 60_000);

type RssPost = {
  title: string;
  slug: string;
  summary: string | null;
  contentMdx: string;
  publishedAt: Date | null;
  updatedAt: Date;
};

function escapeCdata(value: string) {
  return value.replaceAll("]]>", "]]>]]><![CDATA[");
}

export async function GET(request: Request) {
  const bypass = isRateLimitBypassed(request);
  const identifier = resolveRateLimitKey(request, "rss-anonymous");
  const rateResult = await checkRateLimit(`rss:${identifier}`, rssRateLimit, rssRateWindow, { bypass });

  const rateHeaders = buildRateLimitHeaders(rateResult, rssRateLimit);

  if (!rateResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const prismaModule = await import("@/lib/prisma");

  if (!prismaModule.isDatabaseEnabled) {
    return buildRssResponse([], rateHeaders);
  }

  let posts: RssPost[] = [];

  try {
    posts = await prismaModule.safeFindMany<RssPost>("post", {
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

  return buildRssResponse(posts, rateHeaders);
}

function buildRssResponse(posts: RssPost[], rateHeaders: ReturnType<typeof buildRateLimitHeaders>) {
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

  const lastModified = posts[0]?.updatedAt ?? null;
  const etag = createHash("sha256").update(xml).digest("hex");
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=900",
      ETag: etag,
      ...(lastModified ? { "Last-Modified": lastModified.toUTCString() } : {}),
      ...rateHeaders,
    },
  });
}
