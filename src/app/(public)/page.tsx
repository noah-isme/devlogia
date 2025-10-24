import Link from "next/link";

import { Prisma } from "@prisma/client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const searchQuery = typeof searchParams?.q === "string" ? searchParams.q.trim().slice(0, 200) : "";
  const tagParam = typeof searchParams?.tag === "string" ? searchParams.tag : "";
  const tagSlug = tagParam.toLowerCase().replace(/[^a-z0-9-]/g, "");

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
  let loadError: unknown | null = null;

  const tagsPromise = prisma.tag
    .findMany({
      where: { posts: { some: { post: { status: "PUBLISHED" } } } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    })
    .catch((error) => {
      console.error("Failed to load tags for search filters:", error);
      return [] as Array<{ id: string; name: string; slug: string }>;
    });

  try {
    if (searchQuery) {
      const tagFilterSql = tagSlug
        ? Prisma.sql`AND EXISTS (
            SELECT 1
            FROM "PostTag" pt
            INNER JOIN "Tag" t ON t."id" = pt."tagId"
            WHERE pt."postId" = p."id" AND t."slug" = ${tagSlug}
          )`
        : Prisma.sql``;

      const matches = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT p."id"
        FROM "Post" p
        WHERE p."status" = 'PUBLISHED'
        ${tagFilterSql}
        AND p."searchVector" @@ plainto_tsquery('english', ${searchQuery})
        ORDER BY ts_rank(p."searchVector", plainto_tsquery('english', ${searchQuery})) DESC,
                 p."publishedAt" DESC NULLS LAST
        LIMIT ${POSTS_PER_PAGE}
        OFFSET ${(currentPage - 1) * POSTS_PER_PAGE}
      `);

      const ids = matches.map((row) => row.id);
      if (ids.length > 0) {
        const fetched = await prisma.post.findMany({
          where: { id: { in: ids } },
          include: { author: true, tags: { include: { tag: true } } },
        });

        const byId = new Map(fetched.map((post) => [post.id, post]));
        posts = ids
          .map((id) => byId.get(id))
          .filter(Boolean) as PublishedPost[];
      }

      const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "Post" p
        WHERE p."status" = 'PUBLISHED'
        ${tagFilterSql}
        AND p."searchVector" @@ plainto_tsquery('english', ${searchQuery})
      `);

      totalPublished = Number(countResult[0]?.count ?? 0);
    } else {
      const where: Prisma.PostWhereInput = {
        status: "PUBLISHED",
        ...(tagSlug
          ? {
              tags: {
                some: { tag: { slug: tagSlug } },
              },
            }
          : {}),
      };

      [posts, totalPublished] = await Promise.all([
        prisma.post.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          include: { author: true, tags: { include: { tag: true } } },
          take: POSTS_PER_PAGE,
          skip: (currentPage - 1) * POSTS_PER_PAGE,
        }),
        prisma.post.count({ where }),
      ]);
    }
  } catch (error) {
    loadError = error;
    console.error("Failed to load published posts:", error);
  }

  if (loadError) {
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
          <p className="font-medium">Content unavailable</p>
          <p className="mt-2">
            We couldn&apos;t load published posts. Verify your database connection and try again.
          </p>
        </div>
      </section>
    );
  }

  const tags = await tagsPromise;
  const totalPages = Math.max(1, Math.ceil(totalPublished / POSTS_PER_PAGE));
  const hasFilters = Boolean(searchQuery || tagSlug);

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

      <div className="space-y-6 rounded-lg border border-border bg-muted/30 p-4 sm:p-6">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/" method="GET">
          <Input
            type="search"
            name="q"
            placeholder="Search posts…"
            defaultValue={searchQuery}
            className="sm:flex-1"
          />
          {tagSlug ? <input type="hidden" name="tag" value={tagSlug} /> : null}
          <Button type="submit" className="sm:w-auto">
            Search
          </Button>
          {hasFilters ? (
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              Reset
            </Link>
          ) : null}
        </form>

        {tags.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
            {tags.map((tag) => {
              const params = new URLSearchParams();
              if (searchQuery) {
                params.set("q", searchQuery);
              }
              params.set("tag", tag.slug);
              const href = `/?${params.toString()}`;
              const isActive = tagSlug === tag.slug;

              return (
                <Link
                  key={tag.id}
                  href={href}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/60 hover:text-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  #{tag.name}
                </Link>
              );
            })}
            {tagSlug ? (
              <Link
                href={searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : "/"}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Clear tag filter
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-10">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">
            {hasFilters
              ? `No posts found${searchQuery ? ` for “${searchQuery}”` : ""}${tagSlug ? ` with tag #${tagSlug}` : ""}.`
              : "No published posts yet. Check back soon."}
          </p>
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
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        query={{
          q: searchQuery || undefined,
          tag: tagSlug || undefined,
        }}
      />
    </section>
  );
}
