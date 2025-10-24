import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";

const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

type SitemapEntry = {
  slug: string;
  updatedAt: Date;
};

function formatDate(date: Date) {
  return date.toISOString();
}

export async function GET() {
  if (!isDatabaseEnabled) {
    return buildSitemapResponse([], []);
  }

  let posts: SitemapEntry[] = [];
  let pages: SitemapEntry[] = [];

  try {
    const { safeFindMany } = await import("@/lib/prisma");
    [posts, pages] = await Promise.all([
      safeFindMany<SitemapEntry>("post", {
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true },
      }),
      safeFindMany<SitemapEntry>("page", {
        where: { published: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch (error) {
    console.error("Failed to generate sitemap", error);
  }

  return buildSitemapResponse(posts, pages);
}

function buildSitemapResponse(posts: SitemapEntry[], pages: SitemapEntry[]) {
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

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600",
    },
  });
}
