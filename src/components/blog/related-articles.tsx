import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { calculateReadingTime } from "@/lib/reading-time";

export type RelatedArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  contentMdx: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  tags: Array<{ tag: { name: string; slug: string } }>;
};

type RelatedArticlesProps = {
  currentPostId: string;
  tags: string[];
};

export async function RelatedArticles({ currentPostId, tags }: RelatedArticlesProps) {
  let relatedPosts: RelatedArticle[] = [];

  try {
    const prismaModule = await import("@/lib/prisma");
    const { isDatabaseEnabled, prisma } = prismaModule;

    if (isDatabaseEnabled) {
      relatedPosts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          id: { not: currentPostId },
          ...(tags.length > 0
            ? {
                tags: {
                  some: {
                    tag: {
                      slug: { in: tags },
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          contentMdx: true,
          coverUrl: true,
          publishedAt: true,
          tags: { select: { tag: { select: { name: true, slug: true } } } },
        },
      });

      // Fallback if tag intersection has fewer than 3 results
      if (relatedPosts.length < 3) {
        const existingIds = [currentPostId, ...relatedPosts.map((p) => p.id)];
        const fallback = await prisma.post.findMany({
          where: {
            status: "PUBLISHED",
            id: { notIn: existingIds },
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 3 - relatedPosts.length,
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            contentMdx: true,
            coverUrl: true,
            publishedAt: true,
            tags: { select: { tag: { select: { name: true, slug: true } } } },
          },
        });
        relatedPosts = [...relatedPosts, ...fallback];
      }
    }
  } catch (err) {
    console.error("Failed to load related articles", err);
  }

  if (relatedPosts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Related posts" className="mt-16 border-t border-border/60 pt-12">
      <div className="flex items-center justify-between">
        <h3 id="related-articles-title" className="text-2xl font-bold tracking-tight">
          Related posts
        </h3>
        <Link href="/blog" className="text-xs font-semibold text-primary hover:underline">
          Browse all articles →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {relatedPosts.map((post) => {
          const readingTime = calculateReadingTime(post.contentMdx);
          return (
            <article
              key={post.id}
              className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <div className="space-y-3">
                {post.coverUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {post.tags.slice(0, 2).map(({ tag }) => (
                    <Badge key={tag.slug} variant="info" className="text-[10px]">
                      #{tag.name}
                    </Badge>
                  ))}
                  <span className="text-[11px] text-muted-foreground">• {readingTime.text}</span>
                </div>

                <h4 className="text-base font-bold leading-snug tracking-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:text-primary hover:no-underline">
                    {post.title}
                  </Link>
                </h4>

                {post.summary ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {post.summary}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : "Recently"}
                </span>
                <Link href={`/blog/${post.slug}`} className="font-semibold text-primary hover:underline">
                  Read →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
