import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { siteConfig } from "@/lib/seo";

export const revalidate = 60;

type PublicPost = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  publishedAt: string | null;
  updatedAt: string;
  url: string;
};

const getPublishedPosts = unstable_cache(
  async (): Promise<PublicPost[]> => {
    const prismaModule = await import("@/lib/prisma");
    if (!prismaModule.isDatabaseEnabled) {
      return [];
    }

    const posts = await prismaModule.prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      updatedAt: post.updatedAt.toISOString(),
      url: `${siteConfig.url}/blog/${post.slug}`,
    }));
  },
  ["api-posts"],
  { revalidate: 60 },
);

export async function GET() {
  const posts = await getPublishedPosts();
  return NextResponse.json(
    { posts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
