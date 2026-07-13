import Link from "next/link";

import {
  buildArchiveHref,
  type BlogPostWithRelations,
} from "@/lib/blog-public";
import { formatDate } from "@/lib/utils";

type RelatedPostsProps = {
  readonly posts: readonly BlogPostWithRelations[];
};

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Related posts">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Keep exploring
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Related perspectives
          </h2>
        </div>
        <span className="hidden text-xs uppercase tracking-wide text-muted-foreground sm:block">
          Connected by topic
        </span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-foreground/5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Link
                href={buildArchiveHref(post.publishedAt ?? post.createdAt)}
                className="hover:text-foreground hover:underline"
              >
                {formatDate(post.publishedAt ?? post.createdAt)}
              </Link>
            </p>
            <h3 className="mt-3 text-base font-semibold leading-6 tracking-[-0.015em]">
              <Link
                href={`/blog/${post.slug}`}
                className="transition group-hover:text-primary group-hover:no-underline"
              >
                {post.title}
              </Link>
            </h3>
            {post.summary ? (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {post.summary}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
