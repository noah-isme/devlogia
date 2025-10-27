import Link from "next/link";

import { Prisma, type PostStatus } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { buildMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "Posts",
  description: "Manage blog posts and drafts.",
});

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Draft", value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Scheduled", value: "SCHEDULED" },
] as const;

const DEFAULT_LIMIT = 12;

type PostsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type AdminPost = Prisma.PostGetPayload<{
  include: { tags: { include: { tag: true } } };
}>;

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const statusParam = (searchParams?.status as string) ?? "all";
  const activeStatus = statusOptions.some((option) => option.value === statusParam)
    ? statusParam
    : "all";

  const limit = clampLimit(searchParams?.limit, DEFAULT_LIMIT, { min: 5, max: 30 });
  const cursorParam = parseCursorParam(searchParams?.cursor);
  const cursor = decodeCursor(cursorParam);
  const stack = parseStackParam(searchParams?.stack);

  const where: Prisma.Sql[] = [];

  const prismaModule = await import("@/lib/prisma");
  const { prisma, safeFindMany, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Posts unavailable</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to load and manage posts.
        </p>
      </div>
    );
  }

  if (activeStatus !== "all") {
    where.push(Prisma.sql`p."status" = ${activeStatus as PostStatus}`);
  }

  const sortField = Prisma.sql`COALESCE(p."updatedAt", p."createdAt")`;
  const baseConditions = where.length ? where : [Prisma.sql`TRUE`];
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

  let hasNext = rows.length > limit;
  const trimmed = hasNext ? rows.slice(0, limit) : rows;
  const ids = trimmed.map((row) => row.id);

  let posts: AdminPost[] = [];
  if (ids.length > 0) {
    const fetched = await safeFindMany<AdminPost>("post", {
      where: { id: { in: ids } },
      include: { tags: { include: { tag: true } } },
    });
    const byId = new Map(fetched.map((post) => [post.id, post]));
    posts = ids
      .map((id) => byId.get(id))
      .filter(Boolean) as AdminPost[];
  }

  if (!hasNext && posts.length === 0 && cursorParam) {
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
    if (retryRows.length === limit) {
      // assume there may still be older pages available
      hasNext = true;
    }
    if (retryIds.length) {
      const retryFetched = await safeFindMany<AdminPost>("post", {
        where: { id: { in: retryIds } },
        include: { tags: { include: { tag: true } } },
      });
      const retryById = new Map(retryFetched.map((post) => [post.id, post]));
      posts = retryIds
        .map((id) => retryById.get(id))
        .filter(Boolean) as AdminPost[];
    }
  }

  const lastPost = posts.at(-1);
  const nextCursor =
    hasNext && lastPost
      ? encodeCursor({ id: lastPost.id, sortKey: (lastPost.updatedAt ?? lastPost.createdAt).toISOString() })
      : null;

  const hasPrevious = stack.length > 0;
  const nextStack = serializeStack(appendToStack(stack, cursorParam));
  const prevStack = serializeStack(stack.slice(0, -1));
  const prevCursor = stack.length ? stack[stack.length - 1] : null;

  const baseQuery: Record<string, string | undefined> = {
    status: activeStatus !== "all" ? activeStatus : undefined,
    limit: limit !== DEFAULT_LIMIT ? String(limit) : undefined,
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Draft, schedule, and publish posts from a single view.
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className={buttonVariants()}
          data-testid="new-post"
        >
          New post
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statusOptions.map((option) => (
          <Link
            key={option.value}
            href={(() => {
              const params = new URLSearchParams();
              if (option.value !== "all") {
                params.set("status", option.value);
              }
              if (limit !== DEFAULT_LIMIT) {
                params.set("limit", String(limit));
              }
              return params.size ? `/admin/posts?${params.toString()}` : "/admin/posts";
            })()}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              activeStatus === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-foreground/70 hover:text-foreground"
            }`}
            aria-current={activeStatus === option.value ? "page" : undefined}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <div className="space-y-4">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts found. Create one to start publishing.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id} className="rounded-lg border border-border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Link href={`/admin/posts/${post.id}`} className="text-lg font-semibold hover:underline">
                        {post.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">/{post.slug}</p>
                      {post.summary ? (
                        <p className="text-sm text-muted-foreground">{post.summary}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">Updated {formatDate(post.updatedAt)}</p>
                      {post.tags.length ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {post.tags.map(({ tag }) => (
                            <Badge key={tag.id} variant="info">
                              #{tag.name}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        post.status === "PUBLISHED"
                          ? "success"
                          : post.status === "SCHEDULED"
                            ? "warning"
                            : "default"
                      }
                    >
                      {post.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              basePath="/admin/posts"
              hasNext={hasNext}
              hasPrevious={hasPrevious}
              nextQuery={nextQuery}
              previousQuery={previousQuery}
            />
          </>
        )}
      </div>
    </div>
  );
}
