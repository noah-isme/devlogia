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

const sitemapRateLimit = parseRateLimit(process.env.SITEMAP_RATE_LIMIT, 60);
const sitemapRateWindow = parseRateLimit(process.env.SITEMAP_RATE_LIMIT_WINDOW_MS, 60_000);

type SitemapEntry = {
  slug: string;
  updatedAt: Date;
};

function formatDate(date: Date) {
  return date.toISOString();
}

export async function GET(request: Request) {
  const bypass = isRateLimitBypassed(request);
  const identifier = resolveRateLimitKey(request, "sitemap-anonymous");
  const rateResult = await checkRateLimit(`sitemap:${identifier}`, sitemapRateLimit, sitemapRateWindow, { bypass });
  const rateHeaders = buildRateLimitHeaders(rateResult, sitemapRateLimit);

  if (!rateResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const prismaModule = await import("@/lib/prisma");

  if (!prismaModule.isDatabaseEnabled) {
    return buildSitemapResponse([], [], rateHeaders);
  }

  let posts: SitemapEntry[] = [];
  let pages: SitemapEntry[] = [];

  try {
    [posts, pages] = await Promise.all([
      prismaModule.safeFindMany<SitemapEntry>("post", {
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      prismaModule.safeFindMany<SitemapEntry>("page", {
        where: { published: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch (error) {
    console.error("Failed to generate sitemap", error);
  }

  return buildSitemapResponse(posts, pages, rateHeaders);
}

function buildSitemapResponse(
  posts: SitemapEntry[],
  pages: SitemapEntry[],
  rateHeaders: ReturnType<typeof buildRateLimitHeaders>,
) {
  const urls = [
    { loc: siteConfig.url, lastmod: formatDate(new Date()) },
    ...posts.map((post) => ({
      loc: `${siteConfig.url}/blog/${post.slug}`,
      lastmod: formatDate(post.updatedAt),
    })),
    ...pages.map((page) => ({
      loc: `${siteConfig.url}/${page.slug}`,
      lastmod: formatDate(page.updatedAt),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map((url) => `<url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod></url>`)
    .join("\n  ")}
</urlset>`;

  const lastModifiedCandidates = [...posts, ...pages]
    .map((entry) => entry.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime());
  const lastModified = lastModifiedCandidates[0] ?? new Date();
  const etag = createHash("sha256").update(xml).digest("hex");

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=900",
      "Last-Modified": lastModified.toUTCString(),
      ETag: etag,
      ...rateHeaders,
    },
  });
}
