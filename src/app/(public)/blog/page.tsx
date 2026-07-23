import Link from "next/link";

import { EditorialCover } from "@/components/blog/editorial-cover";
import { VectorSearchBar } from "@/components/blog/vector-search-bar";
import { PersonalizedFeedSection } from "@/components/personalization/PersonalizedFeedSection";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  appendToStack,
  clampLimit,
  decodeCursor,
  encodeCursor,
  parseCursorParam,
  parseStackParam,
  serializeStack,
} from "@/lib/pagination";
import {
  buildArchiveBuckets,
  buildArchiveHref,
  buildBlogHref,
  buildEmptyStateCopy,
  buildTagHref,
  DEFAULT_POSTS_PER_PAGE,
  getPostArchiveDate,
  MAX_POSTS_PER_PAGE,
  sanitizeTagSlug,
  type BlogPostWithRelations,
  type BlogTag,
} from "@/lib/blog-public";
import { estimateReadingTime } from "@/lib/utils";

export const revalidate = 120;

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const searchQuery =
    typeof params?.q === "string" ? params.q.trim().slice(0, 200) : "";
  const tagParam = typeof params?.tag === "string" ? params.tag : "";
  const tagSlug = sanitizeTagSlug(tagParam);
  const limit = clampLimit(params?.limit, DEFAULT_POSTS_PER_PAGE, {
    min: 3,
    max: MAX_POSTS_PER_PAGE,
  });
  const cursorParam = parseCursorParam(params?.cursor);
  const cursorPayload = decodeCursor(cursorParam);
  const stack = parseStackParam(params?.stack);

  const prismaModule = await import("@/lib/prisma");
  const { prisma, safeFindMany, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <UnavailableState
        title="Database connection unavailable"
        description="Set the DATABASE_URL environment variable to connect Prisma and load published posts."
      />
    );
  }

  let posts: BlogPostWithRelations[] = [];
  let hasNext = false;
  let loadError: unknown | null = null;

  const tagsPromise = prisma.tag.findMany({
    where: { posts: { some: { post: { status: "PUBLISHED" } } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  }) as Promise<BlogTag[]>;

  try {
    const whereClause = buildWhereClause({ searchQuery, tagSlug });
    const fetchedPosts = await safeFindMany<BlogPostWithRelations>("post", {
      where: whereClause,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      cursor: cursorPayload?.id ? { id: cursorPayload.id } : undefined,
      skip: cursorPayload?.id ? 1 : undefined,
      take: limit + 1,
      include: { author: true, tags: { include: { tag: true } } },
    });

    hasNext = fetchedPosts.length > limit;
    posts = hasNext ? fetchedPosts.slice(0, limit) : fetchedPosts;
  } catch (error) {
    loadError = error;
    console.error("Failed to load published posts:", error);
  }

  if (loadError) {
    return (
      <UnavailableState
        title="Content unavailable"
        description="We couldn't load published posts. Verify your database connection and try again."
      />
    );
  }

  const tags = await tagsPromise;
  const activeTag = tagSlug
    ? tags.find((tag) => tag.slug === tagSlug)
    : undefined;
  const tagName = activeTag?.name ?? (tagSlug ? tagSlug : null);
  const hasPrevious = stack.length > 0;
  const archiveBuckets = buildArchiveBuckets(posts);
  const baseQuery = {
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
  const nextQuery = hasNext
    ? {
        ...baseQuery,
        cursor: nextCursor ?? undefined,
        stack: serializeStack(appendToStack(stack, cursorParam)),
      }
    : undefined;
  const previousQuery = hasPrevious
    ? {
        ...baseQuery,
        cursor: stack.at(-1) ?? undefined,
        stack: serializeStack(stack.slice(0, -1)),
      }
    : undefined;

  return (
    <section className="space-y-12 lg:space-y-16">
      <nav
        aria-label="Breadcrumb"
        className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-border">
            /
          </li>
          <li>
            <Link href="/blog" className="hover:text-foreground">
              Blog
            </Link>
          </li>
          {tagName ? (
            <>
              <li aria-hidden="true" className="text-border">
                /
              </li>
              <li aria-current="page">{tagName}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <header className="grid items-end gap-8 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-14">
        <div className="space-y-5">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <span className="h-px w-8 bg-primary" aria-hidden="true" />
            Devlogia Journal
          </p>
          <h1
            className="text-balance max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl"
            aria-label={tagName ? `${tagName} posts` : undefined}
          >
            {tagName
              ? `${tagName} ideas, thoughtfully explored.`
              : "Ideas for people building what comes next."}
          </h1>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="max-w-xl text-base leading-7 text-muted-foreground lg:pb-2">
            Field notes on engineering, product craft, and the systems behind
            resilient digital businesses—written for clarity, not clicks.
          </p>
          <div className="flex items-center gap-3">
            <VectorSearchBar />
            <Link
              href="/blog/saved"
              className={buttonVariants({ variant: "outline", size: "sm" }) + " shrink-0 rounded-full h-11 px-4 text-xs font-semibold"}
            >
              Saved Articles 🔖
            </Link>
          </div>
        </div>
      </header>

      <DiscoveryPanel
        tags={tags}
        searchQuery={searchQuery}
        tagSlug={tagSlug}
        limit={limit}
        archiveBuckets={archiveBuckets}
      />
      <PostList
        posts={posts}
        searchQuery={searchQuery}
        tagName={tagName}
        tagSlug={tagSlug}
        limit={limit}
      />
      <PersonalizedFeedSection title="Curated for your next deep dive" />
      <Pagination
        basePath="/blog"
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        nextQuery={nextQuery}
        previousQuery={previousQuery}
      />
    </section>
  );
}

function buildWhereClause({
  searchQuery,
  tagSlug,
}: {
  readonly searchQuery: string;
  readonly tagSlug: string;
}) {
  const whereClause = { status: "PUBLISHED" } satisfies Record<string, unknown>;
  const filters = whereClause as typeof whereClause & {
    tags?: unknown;
    OR?: unknown;
  };
  if (tagSlug) {
    filters.tags = { some: { tag: { slug: tagSlug } } };
  }
  if (searchQuery) {
    filters.OR = [
      { title: { contains: searchQuery } },
      { summary: { contains: searchQuery } },
      { contentMdx: { contains: searchQuery } },
    ];
  }
  return filters;
}

function UnavailableState({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <section className="space-y-10">
      <header className="max-w-4xl space-y-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Devlogia Journal
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          Ideas for people building what comes next.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Field notes on engineering, product craft, and resilient digital
          businesses.
        </p>
      </header>
      <div className="premium-surface rounded-3xl p-8 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-2">{description}</p>
      </div>
    </section>
  );
}

function DiscoveryPanel({
  tags,
  searchQuery,
  tagSlug,
  limit,
  archiveBuckets,
}: {
  readonly tags: readonly BlogTag[];
  readonly searchQuery: string;
  readonly tagSlug: string;
  readonly limit: number;
  readonly archiveBuckets: readonly {
    readonly href: string;
    readonly label: string;
    readonly count: number;
  }[];
}) {
  return (
    <section
      className="premium-surface grid gap-6 rounded-[1.75rem] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_20rem]"
      aria-label="Find articles"
    >
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Explore the journal
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
            Find an idea worth your attention
          </h2>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          action="/blog"
          method="GET"
        >
          <Input
            type="search"
            name="q"
            aria-label="Search articles"
            placeholder="Search engineering, product, or strategy..."
            defaultValue={searchQuery}
            className="h-12 rounded-xl border-border/80 bg-background/80 px-4 sm:flex-1"
          />
          {tagSlug ? <input type="hidden" name="tag" value={tagSlug} /> : null}
          {limit !== DEFAULT_POSTS_PER_PAGE ? (
            <input type="hidden" name="limit" value={String(limit)} />
          ) : null}
          <Button type="submit" className="h-12 rounded-xl px-6 sm:w-auto">
            Search
          </Button>
          {searchQuery || tagSlug ? (
            <Link href="/blog" className={buttonVariants({ variant: "ghost" })}>
              Reset
            </Link>
          ) : null}
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Topics
          </span>
          {tags.map((tag) => {
            const isActive = tagSlug === tag.slug;
            return (
              <Link
                key={tag.id}
                href={buildTagHref(tag.slug, { q: searchQuery, limit })}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:no-underline ${isActive ? "border-foreground bg-foreground text-background" : "border-border/80 bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
                aria-current={isActive ? "page" : undefined}
              >
                {tag.name}
              </Link>
            );
          })}
          {tagSlug ? (
            <Link
              href={buildBlogHref({ q: searchQuery, limit })}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Clear tag filter
            </Link>
          ) : null}
        </div>
      </div>
      <aside
        className="rounded-2xl border border-border/70 bg-foreground p-5 text-background"
        aria-label="Archive by month"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-background/55">
          Browse the archive
        </h2>
        {archiveBuckets.length ? (
          <ol className="mt-4 space-y-1 text-sm">
            {archiveBuckets.map((bucket) => (
              <li
                key={bucket.href}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2"
              >
                <Link
                  href={bucket.href}
                  className="font-medium hover:text-background hover:underline"
                >
                  {bucket.label}
                </Link>
                <span className="rounded-full bg-background/10 px-2 py-0.5 text-xs text-background/60">
                  {bucket.count}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-background/60">
            Archive links appear when posts are available.
          </p>
        )}
      </aside>
    </section>
  );
}

function PostList({
  posts,
  searchQuery,
  tagName,
  tagSlug,
  limit,
}: {
  readonly posts: readonly BlogPostWithRelations[];
  readonly searchQuery: string;
  readonly tagName?: string | null;
  readonly tagSlug: string;
  readonly limit: number;
}) {
  if (posts.length === 0) {
    const copy = buildEmptyStateCopy({ searchQuery, tagName });
    return (
      <div
        role="status"
        className="premium-surface space-y-5 rounded-3xl p-8 text-sm text-muted-foreground"
      >
        <div>
          <p className="text-lg font-semibold text-foreground">{copy.title}</p>
          <p className="mt-2">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {searchQuery ? (
            <Link
              href={buildBlogHref({ tag: tagSlug, limit })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Clear search
            </Link>
          ) : null}
          {tagSlug ? (
            <Link
              href={buildBlogHref({ q: searchQuery, limit })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Clear tag
            </Link>
          ) : null}
          <Link
            href="/blog"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Browse all posts
          </Link>
        </div>
      </div>
    );
  }

  const [featuredPost, ...remainingPosts] = posts;

  return (
    <section className="space-y-8" aria-labelledby="latest-stories">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Fresh thinking
          </p>
          <h2
            id="latest-stories"
            className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
          >
            Latest stories
          </h2>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:block">
          Selected by the Devlogia editorial desk
        </span>
      </div>

      <article className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <Link
          href={`/blog/${featuredPost.slug}`}
          className="block hover:no-underline"
        >
          {featuredPost.coverUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-3xl bg-muted shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredPost.coverUrl}
                alt={featuredPost.title}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
          ) : (
            <EditorialCover
              title={featuredPost.title}
              eyebrow={featuredPost.tags[0]?.tag.name ?? "Featured story"}
            />
          )}
        </Link>
        <div className="space-y-5 lg:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            <Link
              href={buildArchiveHref(
                featuredPost.publishedAt ?? featuredPost.createdAt,
              )}
            >
              {getPostArchiveDate(featuredPost)}
            </Link>{" "}
            · {estimateReadingTime(featuredPost.contentMdx)}
          </p>
          <h3 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
            <Link
              href={`/blog/${featuredPost.slug}`}
              className="hover:text-primary hover:no-underline"
            >
              {featuredPost.title}
            </Link>
          </h3>
          {featuredPost.summary ? (
            <p className="text-base leading-7 text-muted-foreground">
              {featuredPost.summary}
            </p>
          ) : null}
          <Link
            href={`/blog/${featuredPost.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:no-underline"
          >
            Read the story <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>

      {remainingPosts.length ? (
        <div className="grid gap-x-6 gap-y-10 border-t border-border/70 pt-8 md:grid-cols-2 xl:grid-cols-3">
          {remainingPosts.map((post) => (
            <article key={post.id} className="group flex h-full flex-col">
              <Link
                href={`/blog/${post.slug}`}
                className="mb-5 block hover:no-underline"
              >
                {post.coverUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl bg-muted shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverUrl}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <EditorialCover
                    title={post.title}
                    eyebrow={post.tags[0]?.tag.name ?? "Journal"}
                    compact
                  />
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  <Link
                    href={buildArchiveHref(post.publishedAt ?? post.createdAt)}
                  >
                    {getPostArchiveDate(post)}
                  </Link>{" "}
                  · {estimateReadingTime(post.contentMdx)}
                </p>
                <h3 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.025em]">
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
                <div className="mt-5 flex flex-wrap gap-2">
                  {post.tags.slice(0, 3).map(({ tag }) => (
                    <Link
                      key={tag.id}
                      href={buildTagHref(tag.slug)}
                      className="rounded-full bg-muted/80 px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:no-underline"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
