import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type FeaturedArticleItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  tags: Array<{ tag: { name: string; slug: string } }>;
};

type FeaturedArticlesProps = {
  articles: FeaturedArticleItem[];
};

export function FeaturedArticles({ articles }: FeaturedArticlesProps) {
  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="featured-articles-heading" className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Fresh Perspectives
          </p>
          <h2 id="featured-articles-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Latest Technology & AI Articles
          </h2>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/blog">View All Articles →</Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((post) => (
          <article
            key={post.id}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/50 hover:shadow-md"
          >
            <div className="space-y-4">
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

              <div className="flex flex-wrap gap-1.5">
                {post.tags.map(({ tag }) => (
                  <Badge key={tag.slug} variant="info" className="text-[10px]">
                    #{tag.name}
                  </Badge>
                ))}
              </div>

              <h3 className="text-xl font-bold leading-snug tracking-tight">
                <Link href={`/blog/${post.slug}`} className="hover:text-primary hover:no-underline">
                  {post.title}
                </Link>
              </h3>

              {post.summary ? (
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {post.summary}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
              <span className="text-muted-foreground">
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently published"}
              </span>
              <Link href={`/blog/${post.slug}`} className="font-semibold text-primary hover:underline">
                Read Article →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
