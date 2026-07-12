import Link from "next/link";

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
  const searchQuery = typeof params?.q === "string" ? params.q.trim().slice(0, 200) : "";
  const tagParam = typeof params?.tag === "string" ? params.tag : "";
  const tagSlug = sanitizeTagSlug(tagParam);
  const limit = clampLimit(params?.limit, DEFAULT_POSTS_PER_PAGE, { min: 3, max: MAX_POSTS_PER_PAGE });
  const cursorParam = parseCursorParam(params?.cursor);
  const cursorPayload = decodeCursor(cursorParam);
  const stack = parseStackParam(params?.stack);

  const prismaModule = await import("@/lib/prisma");
  const { prisma, safeFindMany, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return <UnavailableState title="Database connection unavailable" description="Set the DATABASE_URL environment variable to connect Prisma and load published posts." />;
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
    return <UnavailableState title="Content unavailable" description="We couldn't load published posts. Verify your database connection and try again." />;
  }

  const tags = await tagsPromise;
  const activeTag = tagSlug ? tags.find((tag) => tag.slug === tagSlug) : undefined;
  const tagName = activeTag?.name ?? (tagSlug ? tagSlug : null);
  const hasPrevious = stack.length > 0;
  const archiveBuckets = buildArchiveBuckets(posts);
  const baseQuery = { q: searchQuery || undefined, tag: tagSlug || undefined, limit: limit !== DEFAULT_POSTS_PER_PAGE ? String(limit) : undefined };
  const lastPost = posts.at(-1);
  const nextCursor = hasNext && lastPost ? encodeCursor({ id: lastPost.id, sortKey: (lastPost.publishedAt ?? lastPost.createdAt).toISOString() }) : null;
  const nextQuery = hasNext ? { ...baseQuery, cursor: nextCursor ?? undefined, stack: serializeStack(appendToStack(stack, cursorParam)) } : undefined;
  const previousQuery = hasPrevious ? { ...baseQuery, cursor: stack.at(-1) ?? undefined, stack: serializeStack(stack.slice(0, -1)) } : undefined;

  return (
    <section className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
          {tagName ? <><li aria-hidden="true">/</li><li aria-current="page">{tagName}</li></> : null}
        </ol>
      </nav>

      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Public archive</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {tagName ? `${tagName} posts` : "Deep writing for curious developers"}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Devlogia combines MDX, autosave, and SEO-friendly defaults so you can share long-form insights without friction.
        </p>
      </header>

      <PersonalizedFeedSection />
      <DiscoveryPanel tags={tags} searchQuery={searchQuery} tagSlug={tagSlug} limit={limit} archiveBuckets={archiveBuckets} />
      <PostList posts={posts} searchQuery={searchQuery} tagName={tagName} tagSlug={tagSlug} limit={limit} />
      <Pagination basePath="/blog" hasNext={hasNext} hasPrevious={hasPrevious} nextQuery={nextQuery} previousQuery={previousQuery} />
    </section>
  );
}

function buildWhereClause({ searchQuery, tagSlug }: { readonly searchQuery: string; readonly tagSlug: string }) {
  const whereClause = { status: "PUBLISHED" } satisfies Record<string, unknown>;
  const filters = whereClause as typeof whereClause & { tags?: unknown; OR?: unknown };
  if (tagSlug) {
    filters.tags = { some: { tag: { slug: tagSlug } } };
  }
  if (searchQuery) {
    filters.OR = [{ title: { contains: searchQuery } }, { summary: { contains: searchQuery } }, { contentMdx: { contains: searchQuery } }];
  }
  return filters;
}

function UnavailableState({ title, description }: { readonly title: string; readonly description: string }) {
  return (
    <section className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Deep writing for curious developers</h1>
        <p className="max-w-2xl text-base text-muted-foreground">Devlogia combines MDX, autosave, and SEO-friendly defaults so you can share long-form insights without friction.</p>
      </header>
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-2">{description}</p>
      </div>
    </section>
  );
}

function DiscoveryPanel({ tags, searchQuery, tagSlug, limit, archiveBuckets }: { readonly tags: readonly BlogTag[]; readonly searchQuery: string; readonly tagSlug: string; readonly limit: number; readonly archiveBuckets: readonly { readonly href: string; readonly label: string; readonly count: number }[] }) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center" action="/blog" method="GET">
          <Input type="search" name="q" placeholder="Search posts..." defaultValue={searchQuery} className="sm:flex-1" />
          {tagSlug ? <input type="hidden" name="tag" value={tagSlug} /> : null}
          {limit !== DEFAULT_POSTS_PER_PAGE ? <input type="hidden" name="limit" value={String(limit)} /> : null}
          <Button type="submit" className="sm:w-auto">Search</Button>
          {searchQuery || tagSlug ? <Link href="/blog" className={buttonVariants({ variant: "ghost" })}>Reset</Link> : null}
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Tags</span>
          {tags.map((tag) => {
            const isActive = tagSlug === tag.slug;
            return <Link key={tag.id} href={buildTagHref(tag.slug, { q: searchQuery, limit })} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${isActive ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:border-foreground/60 hover:text-foreground"}`} aria-current={isActive ? "page" : undefined}>#{tag.name}</Link>;
          })}
          {tagSlug ? <Link href={buildBlogHref({ q: searchQuery, limit })} className="text-xs text-muted-foreground underline-offset-4 hover:underline">Clear tag filter</Link> : null}
        </div>
      </div>
      <aside className="rounded-md border border-border bg-background/80 p-4" aria-label="Archive by month">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Archive</h2>
        {archiveBuckets.length ? <ol className="mt-3 space-y-2 text-sm">{archiveBuckets.map((bucket) => <li key={bucket.href} className="flex items-center justify-between gap-3"><Link href={bucket.href} className="hover:text-primary hover:underline">{bucket.label}</Link><span className="text-muted-foreground">{bucket.count}</span></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">Archive links appear when posts are available.</p>}
      </aside>
    </div>
  );
}

function PostList({ posts, searchQuery, tagName, tagSlug, limit }: { readonly posts: readonly BlogPostWithRelations[]; readonly searchQuery: string; readonly tagName?: string | null; readonly tagSlug: string; readonly limit: number }) {
  if (posts.length === 0) {
    const copy = buildEmptyStateCopy({ searchQuery, tagName });
    return <div role="status" className="space-y-4 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground"><div><p className="font-medium text-foreground">{copy.title}</p><p className="mt-2">{copy.description}</p></div><div className="flex flex-wrap gap-2">{searchQuery ? <Link href={buildBlogHref({ tag: tagSlug, limit })} className={buttonVariants({ variant: "outline", size: "sm" })}>Clear search</Link> : null}{tagSlug ? <Link href={buildBlogHref({ q: searchQuery, limit })} className={buttonVariants({ variant: "outline", size: "sm" })}>Clear tag</Link> : null}<Link href="/blog" className={buttonVariants({ variant: "ghost", size: "sm" })}>Browse all posts</Link></div></div>;
  }

  return (
    <div className="space-y-10">
      {posts.map((post) => <article key={post.id} className="space-y-3 border-b border-border pb-8 last:border-b-0 last:pb-0"><header className="space-y-2"><p className="text-sm text-muted-foreground"><Link href={buildArchiveHref(post.publishedAt ?? post.createdAt)} className="hover:text-foreground hover:underline">{getPostArchiveDate(post)}</Link> · {estimateReadingTime(post.contentMdx)}</p><h2 className="text-2xl font-semibold tracking-tight"><Link href={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link></h2>{post.summary ? <p className="text-base text-muted-foreground">{post.summary}</p> : null}</header>{post.tags.length ? <div className="flex flex-wrap gap-2">{post.tags.map(({ tag }) => <Link key={tag.id} href={buildTagHref(tag.slug)} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">#{tag.name}</Link>)}</div> : null}</article>)}
    </div>
  );
}
