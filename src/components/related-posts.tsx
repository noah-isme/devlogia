import Link from "next/link";

import { buildArchiveHref, type BlogPostWithRelations } from "@/lib/blog-public";
import { formatDate } from "@/lib/utils";

type RelatedPostsProps = {
  readonly posts: readonly BlogPostWithRelations[];
};

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="not-prose mt-10 rounded-lg border border-border bg-muted/30 p-5" aria-label="Related posts">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Related posts</h2>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">By shared tags</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="rounded-md border border-border bg-background/80 p-4">
            <p className="text-xs text-muted-foreground">
              <Link href={buildArchiveHref(post.publishedAt ?? post.createdAt)} className="hover:text-foreground hover:underline">
                {formatDate(post.publishedAt ?? post.createdAt)}
              </Link>
            </p>
            <h3 className="mt-2 text-sm font-semibold leading-6">
              <Link href={`/blog/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
            </h3>
            {post.summary ? <p className="mt-2 text-sm text-muted-foreground">{post.summary}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
