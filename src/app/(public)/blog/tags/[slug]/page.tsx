import type { Metadata } from "next";

import BlogPage from "@/app/(public)/blog/page";
import { sanitizeTagSlug } from "@/lib/blog-public";
import { buildMetadata, siteConfig } from "@/lib/seo";

type TagPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tagSlug = sanitizeTagSlug(slug);

  return buildMetadata({
    title: `#${tagSlug} posts`,
    description: `Browse Devlogia posts tagged ${tagSlug}.`,
    alternates: { canonical: `${siteConfig.url}/blog/tags/${tagSlug}` },
  });
}

export default async function TagArchivePage({ params, searchParams }: TagPageProps) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  return BlogPage({
    searchParams: Promise.resolve({
      ...(resolvedSearchParams ?? {}),
      tag: sanitizeTagSlug(slug),
    }),
  });
}
