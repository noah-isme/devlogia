import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

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
      <ScrollReveal direction="up">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Fresh Perspectives
            </p>
            <h2 id="featured-articles-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Latest Technology & AI Articles
            </h2>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-full btn-interactive">
            <Link href="/blog">View All Articles →</Link>
          </Button>
        </div>
      </ScrollReveal>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((post, index) => (
          <ScrollReveal key={post.id} direction="up" staggerIndex={index}>
            <article className="group interactive-card flex flex-col justify-between h-full rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:border-primary/40">
              <div className="space-y-4">
                {post.coverUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
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

                <h3 className="text-xl font-bold leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
                  <Link href={`/blog/${post.slug}`} className="hover:no-underline">
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
                <Link href={`/blog/${post.slug}`} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <span>Read Article</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
