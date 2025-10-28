import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";

export const revalidate = 60;

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

export async function GET() {
  const pages = await getPages();
  return NextResponse.json(
    { pages },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
