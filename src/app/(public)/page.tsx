import Link from "next/link";

import { Prisma } from "@prisma/client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  appendToStack,
  buildCursorCondition,
  clampLimit,
  decodeCursor,
  encodeCursor,
  parseCursorParam,
  parseStackParam,
  serializeStack,
} from "@/lib/pagination";
import { estimateReadingTime, formatDate } from "@/lib/utils";

const DEFAULT_POSTS_PER_PAGE = 10;
const MAX_POSTS_PER_PAGE = 25;

const isDatabaseEnabled = Boolean(process.env.DATABASE_URL);

type HomePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type PublishedPost = Prisma.PostGetPayload<{
  include: { author: true; tags: { include: { tag: true } } };
}>;

export default async function HomePage({ searchParams }: HomePageProps) {
  const searchQuery = typeof searchParams?.q === "string" ? searchParams.q.trim().slice(0, 200) : "";
  const tagParam = typeof searchParams?.tag === "string" ? searchParams.tag : "";
  const tagSlug = tagParam.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const limit = clampLimit(searchParams?.limit, DEFAULT_POSTS_PER_PAGE, {
    min: 3,
    max: MAX_POSTS_PER_PAGE,
  });

  const cursorParam = parseCursorParam(searchParams?.cursor);
  const cursor = decodeCursor(cursorParam);
  const stack = parseStackParam(searchParams?.stack);

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

  let posts: PublishedPost[] = [];
  let hasNext = false;
  let loadError: unknown | null = null;

  const { prisma, safeFindMany } = await import("@/lib/prisma");

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
    const sortField = Prisma.sql`COALESCE(p."publishedAt", p."createdAt")`;
    const baseConditions: Prisma.Sql[] = [Prisma.sql`p."status" = 'PUBLISHED'`];

    if (tagSlug) {
      baseConditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "PostTag" pt INNER JOIN "Tag" t ON t."id" = pt."tagId" WHERE pt."postId" = p."id" AND t."slug" = ${tagSlug})`,
      );
    }

    if (searchQuery) {
      baseConditions.push(Prisma.sql`p."searchVector" @@ plainto_tsquery('english', ${searchQuery})`);
    }

    const cursorCondition = buildCursorCondition(sortField, cursor);
    const allConditions = cursorCondition ? [...baseConditions, cursorCondition] : baseConditions;
    const whereClause = allConditions.slice(1).reduce(
      (acc, condition) => Prisma.sql`${acc} AND ${condition}`,
      allConditions[0],
    );

    const rows = await prisma.$queryRaw<Array<{ id: string; sortKey: Date }>>(Prisma.sql`
      SELECT p."id", ${sortField} AS "sortKey"
      FROM "Post" p
      WHERE ${whereClause}
      ORDER BY ${sortField} DESC, p."id" DESC
      LIMIT ${limit + 1}
    `);

    hasNext = rows.length > limit;
    const trimmed = hasNext ? rows.slice(0, limit) : rows;
    const ids = trimmed.map((row) => row.id);

    if (ids.length > 0) {
      const fetched = await safeFindMany<PublishedPost>("post", {
        where: { id: { in: ids } },
        include: { author: true, tags: { include: { tag: true } } },
      });

      const byId = new Map(fetched.map((post) => [post.id, post]));
      posts = ids
        .map((id) => byId.get(id))
        .filter(Boolean) as PublishedPost[];
    }

    if (!hasNext && posts.length === 0 && cursorParam) {
      // cursor was stale; retry from beginning once
      const retryWhereClause = baseConditions.slice(1).reduce(
        (acc, condition) => Prisma.sql`${acc} AND ${condition}`,
        baseConditions[0],
      );
      const retryRows = await prisma.$queryRaw<Array<{ id: string; sortKey: Date }>>(Prisma.sql`
        SELECT p."id", ${sortField} AS "sortKey"
        FROM "Post" p
        WHERE ${retryWhereClause}
        ORDER BY ${sortField} DESC, p."id" DESC
        LIMIT ${limit}
      `);

      const retryIds = retryRows.map((row) => row.id);
      hasNext = retryRows.length === limit;
      if (retryIds.length > 0) {
        const retryFetched = await safeFindMany<PublishedPost>("post", {
          where: { id: { in: retryIds } },
          include: { author: true, tags: { include: { tag: true } } },
        });
        const retryById = new Map(retryFetched.map((post) => [post.id, post]));
        posts = retryIds
          .map((id) => retryById.get(id))
          .filter(Boolean) as PublishedPost[];
      }
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
  const hasFilters = Boolean(searchQuery || tagSlug);
  const hasPrevious = stack.length > 0;

  const baseQuery: Record<string, string | undefined> = {
    q: searchQuery || undefined,
    tag: tagSlug || undefined,
    limit: limit !== DEFAULT_POSTS_PER_PAGE ? String(limit) : undefined,
  };

  const lastPost = posts.at(-1);
  const nextCursor =
    hasNext && lastPost
      ? encodeCursor({
          id: lastPost.id,
          sortKey: (lastPost.publishedAt ?? lastPost.createdAt).toISOString(),
        })
      : null;

  const nextStack = serializeStack(appendToStack(stack, cursorParam));
  const prevStack = serializeStack(stack.slice(0, -1));
  const prevCursor = stack.length ? stack[stack.length - 1] : null;

  const nextQuery = hasNext
    ? {
        ...baseQuery,
        cursor: nextCursor ?? undefined,
        stack: nextStack,
      }
    : undefined;

  const previousQuery = hasPrevious
    ? {
        ...baseQuery,
        cursor: prevCursor ?? undefined,
        stack: prevStack,
      }
    : undefined;

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
          {limit !== DEFAULT_POSTS_PER_PAGE ? <input type="hidden" name="limit" value={String(limit)} /> : null}
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
              if (limit !== DEFAULT_POSTS_PER_PAGE) {
                params.set("limit", String(limit));
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
                href={(() => {
                  const params = new URLSearchParams();
                  if (searchQuery) params.set("q", searchQuery);
                  if (limit !== DEFAULT_POSTS_PER_PAGE) params.set("limit", String(limit));
                  return params.size ? `/?${params.toString()}` : "/";
                })()}
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
        basePath="/"
        hasNext={Boolean(hasNext)}
        hasPrevious={hasPrevious}
        nextQuery={nextQuery}
        previousQuery={previousQuery}
      />
    </section>
  );
}
