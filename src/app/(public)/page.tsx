import Link from "next/link";

import type { Prisma } from "@prisma/client";

import { Pagination } from "@/components/ui/pagination";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { estimateReadingTime, formatDate } from "@/lib/utils";

const POSTS_PER_PAGE = 5;

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const page = Number(searchParams?.page ?? 1);
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;

  if (!isDatabaseEnabled) {
    return (
      <section className="space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Deep writing for curious developers
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Devlogia combines MDX, autosave, and SEO-friendly defaults so you can share long-form insights without
            friction.
          </p>
        </header>
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium">Database connection unavailable</p>
          <p className="mt-2">
            Set the <code>DATABASE_URL</code> environment variable to connect Prisma and load published posts.
          </p>
        </div>
      </section>
    );
  }

  type PublishedPost = Prisma.PostGetPayload<{
    include: { author: true; tags: { include: { tag: true } } };
  }>;

  let posts: PublishedPost[] = [];
  let totalPublished = 0;

  try {
    [posts, totalPublished] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        include: { author: true, tags: { include: { tag: true } } },
        take: POSTS_PER_PAGE,
        skip: (currentPage - 1) * POSTS_PER_PAGE,
      }),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
    ]);
  } catch (error) {
    console.error("Failed to load published posts:", error);
    return (
      <section className="space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Deep writing for curious developers
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Devlogia combines MDX, autosave, and SEO-friendly defaults so you can share long-form insights without friction.
          </p>
        </header>
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium">Database connection failed</p>
          <p className="mt-2">
            Verify your database credentials and availability to show published posts.
          </p>
        </div>
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalPublished / POSTS_PER_PAGE));

  return (
    <section className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Deep writing for curious developers
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Devlogia combines MDX, autosave, and SEO-friendly defaults so you can share long-form insights without friction.
        </p>
      </header>

      <div className="space-y-10">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No published posts yet. Check back soon.</p>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="space-y-3 border-b border-border pb-8 last:border-b-0 last:pb-0">
              <header className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {post.publishedAt ? formatDate(post.publishedAt) : "Draft"} · {estimateReadingTime(post.contentMdx)}
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                {post.summary ? (
                  <p className="text-base text-muted-foreground">{post.summary}</p>
                ) : null}
              </header>
              {post.tags.length ? (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} />
    </section>
  );
}
