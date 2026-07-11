import type { Prisma } from "@prisma/client";

import { formatDate } from "@/lib/utils";

export const DEFAULT_POSTS_PER_PAGE = 10;
export const MAX_POSTS_PER_PAGE = 25;

export type BlogPostWithRelations = Prisma.PostGetPayload<{
  include: { author: true; tags: { include: { tag: true } } };
}>;

export type BlogTag = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export type ArchiveBucket = {
  readonly year: string;
  readonly month: string;
  readonly label: string;
  readonly href: string;
  readonly count: number;
};

export function sanitizeTagSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function buildBlogHref(query: { readonly q?: string; readonly tag?: string; readonly limit?: number }) {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.tag) {
    params.set("tag", query.tag);
  }
  if (query.limit && query.limit !== DEFAULT_POSTS_PER_PAGE) {
    params.set("limit", String(query.limit));
  }
  return params.size ? `/blog?${params.toString()}` : "/blog";
}

export function buildTagHref(slug: string, query?: { readonly q?: string; readonly limit?: number }) {
  const params = new URLSearchParams();
  if (query?.q) {
    params.set("q", query.q);
  }
  if (query?.limit && query.limit !== DEFAULT_POSTS_PER_PAGE) {
    params.set("limit", String(query.limit));
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return `/blog/tags/${slug}${suffix}`;
}

export function buildArchiveHref(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `/blog/archive/${year}/${month}`;
}

export function formatArchiveLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildArchiveBuckets(posts: readonly BlogPostWithRelations[]) {
  const buckets = new Map<string, ArchiveBucket>();
  for (const post of posts) {
    const date = post.publishedAt ?? post.createdAt;
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    const existing = buckets.get(key);
    buckets.set(key, {
      year,
      month,
      label: formatArchiveLabel(date),
      href: buildArchiveHref(date),
      count: (existing?.count ?? 0) + 1,
    });
  }
  return Array.from(buckets.values()).sort((a, b) => `${b.year}${b.month}`.localeCompare(`${a.year}${a.month}`));
}

export function buildEmptyStateCopy(query: { readonly searchQuery: string; readonly tagName?: string | null }) {
  if (query.searchQuery && query.tagName) {
    return {
      title: `No posts match "${query.searchQuery}" in ${query.tagName}`,
      description: "Try a broader keyword, remove the tag, or browse the full archive.",
    };
  }
  if (query.searchQuery) {
    return {
      title: `No posts match "${query.searchQuery}"`,
      description: "Try a broader keyword or browse the archive by month.",
    };
  }
  if (query.tagName) {
    return {
      title: `No posts published in ${query.tagName} yet`,
      description: "Clear the tag to browse every published post.",
    };
  }
  return {
    title: "No published posts yet",
    description: "Check back soon for deep technical writing.",
  };
}

export function getPostArchiveDate(post: BlogPostWithRelations) {
  return post.publishedAt ? formatDate(post.publishedAt) : "Draft";
}
