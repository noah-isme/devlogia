import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

import { Prisma, type PostStatus } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import { BulkPostManager } from "@/components/admin/BulkPostManager";
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
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Posts",
  description: "Manage blog posts and drafts.",
});

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Draft", value: "DRAFT" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Changes Requested", value: "CHANGES_REQUESTED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Scheduled", value: "SCHEDULED" },
] as const;

const DEFAULT_LIMIT = 5;

type PostsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AdminPost = Prisma.PostGetPayload<{
  include: { tags: { include: { tag: true } } };
}>;

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const statusParam = (resolvedSearchParams.status as string) ?? "all";
  const activeStatus = statusOptions.some((option) => option.value === statusParam)
    ? statusParam
    : "all";

  const limit = clampLimit(resolvedSearchParams.limit, DEFAULT_LIMIT, { min: 5, max: 30 });
  const cursorParam = parseCursorParam(resolvedSearchParams.cursor);
  const cursor = decodeCursor(cursorParam);
  const stack = parseStackParam(resolvedSearchParams.stack);

  const prismaModule = await import("@/lib/prisma");
  const { safeFindMany, isDatabaseEnabled } = prismaModule;
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

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

  const where: Prisma.PostWhereInput = {
    ...(activeStatus !== "all" ? { status: activeStatus as PostStatus } : {}),
    ...(cursor
      ? {
          OR: [
            { updatedAt: { lt: new Date(cursor.sortKey) } },
            { updatedAt: new Date(cursor.sortKey), id: { lt: cursor.id } },
          ],
        }
      : {}),
  };

  const rows = await safeFindMany<AdminPost>("post", {
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { tags: { include: { tag: true } } },
  });

  const hasNext = rows.length > limit;
  const posts = hasNext ? rows.slice(0, limit) : rows;

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
        <Link href="/admin/posts/new" className={buttonVariants()}>
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
            className={`rounded-full border px-3 py-1 text-sm transition ${activeStatus === option.value
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
        <BulkPostManager
          posts={posts.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            summary: p.summary,
            status: p.status,
            updatedAt: (p.updatedAt ?? p.createdAt).toISOString(),
            tags: p.tags,
          }))}
        />
        <Pagination
          basePath="/admin/posts"
          hasNext={hasNext}
          hasPrevious={hasPrevious}
          nextQuery={nextQuery}
          previousQuery={previousQuery}
        />
      </div>
    </div>
  );
}
