import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";
import { buildRateLimitHeaders, checkRateLimit, parseRateLimit, resolveRateLimitKey } from "@/lib/ratelimit";

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
  const rateResult = checkRateLimit(rateKey, pagesRateLimit, pagesRateWindow);

  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: buildRateLimitHeaders(rateResult, pagesRateLimit) },
    );
  }

  const pages = await getPages();
  return NextResponse.json(
    { pages },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        ...buildRateLimitHeaders(rateResult, pagesRateLimit),
      },
    },
  );
}
