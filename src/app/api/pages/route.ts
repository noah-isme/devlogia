import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  isRateLimitBypassed,
  parseRateLimit,
  resolveRateLimitKey,
} from "@/lib/ratelimit";

export const revalidate = 60;

const pagesRateLimit = parseRateLimit(process.env.PAGES_RATE_LIMIT, 120);
const pagesRateWindow = parseRateLimit(process.env.PAGES_RATE_LIMIT_WINDOW_MS, 60_000);

type PublicPage = {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  url: string;
};

const getPages = unstable_cache(
  async (): Promise<PublicPage[]> => {
    const prismaModule = await import("@/lib/prisma");
    if (!prismaModule.isDatabaseEnabled) {
      return [];
    }

    const pages = await prismaModule.prisma.page.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        updatedAt: true,
      },
    });

    return pages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      published: page.published,
      updatedAt: page.updatedAt.toISOString(),
      url: `${siteConfig.url}/${page.slug}`,
    }));
  },
  ["api-pages"],
  { revalidate: 60 },
);

export async function GET(request: Request) {
  const identifier = resolveRateLimitKey(request, "pages-anonymous");
  const rateKey = `pages:${identifier}`;
  const bypass = isRateLimitBypassed(request);
  const rateResult = await checkRateLimit(rateKey, pagesRateLimit, pagesRateWindow, { bypass });
  const rateHeaders = buildRateLimitHeaders(rateResult, pagesRateLimit);

  if (!rateResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const pages = await getPages();
  const payload = { pages };
  const json = JSON.stringify(payload);
  const hash = createHash("sha256").update(json).digest("hex");
  const latest = pages[0]?.updatedAt ?? null;

  const response = new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      ...rateHeaders,
    },
  });

  response.headers.set("ETag", hash);
  if (latest) {
    response.headers.set("Last-Modified", new Date(latest).toUTCString());
  }

  return response;
}
