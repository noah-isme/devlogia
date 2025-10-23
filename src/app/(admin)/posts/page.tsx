import Link from "next/link";

import type { PostStatus, Prisma } from "@prisma/client";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
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

type PostsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const statusParam = (searchParams?.status as string) ?? "all";
  const activeStatus = statusOptions.some((option) => option.value === statusParam)
    ? statusParam
    : "all";

  const where: Prisma.PostWhereInput | undefined =
    activeStatus === "all"
      ? undefined
      : { status: activeStatus as PostStatus };

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

  const posts = await prisma.post.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { tags: { include: { tag: true } } },
  });

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
            href={option.value === "all" ? "/admin/posts" : `/admin/posts?status=${option.value}`}
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
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(post.updatedAt)}
                    </p>
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
        )}
      </div>
    </div>
  );
}
