import type { Metadata } from "next";
import Link from "next/link";

import type { PostStatus } from "@prisma/client";

import { buildMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

type DashboardLatestPost = {
  id: string;
  title: string;
  status: PostStatus;
  updatedAt: Date;
};

type DashboardMetrics = {
  drafts: number;
  published: number;
  scheduled: number;
  latestPosts: DashboardLatestPost[];
};

export const metadata: Metadata = buildMetadata({
  title: "Dashboard",
  description: "Overview of Devlogia content health.",
});

export default async function DashboardPage() {
  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma, safeFindMany } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Database connection required</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to load dashboard insights.
        </p>
      </div>
    );
  }

  let metrics: DashboardMetrics | null = null;

  try {
    const [drafts, published, scheduled, latestPosts] = await Promise.all([
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "SCHEDULED" } }),
      safeFindMany<DashboardLatestPost>("post", {
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    metrics = { drafts, published, scheduled, latestPosts };
  } catch (error) {
    console.error("Failed to load dashboard metrics", error);
  }

  if (!metrics) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Dashboard unavailable</p>
        <p>We couldn&apos;t load content metrics. Verify your database connection and try again.</p>
      </div>
    );
  }

  const { drafts, published, scheduled, latestPosts } = metrics;

  return (
    <div className="space-y-10" data-testid="dashboard-root">
      <section>
        <h2 className="text-lg font-semibold">Content health</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <dt className="text-sm text-muted-foreground">Draft posts</dt>
            <dd className="mt-2 text-2xl font-semibold">{drafts}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <dt className="text-sm text-muted-foreground">Published posts</dt>
            <dd className="mt-2 text-2xl font-semibold">{published}</dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <dt className="text-sm text-muted-foreground">Scheduled posts</dt>
            <dd className="mt-2 text-2xl font-semibold">{scheduled}</dd>
          </div>
        </dl>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent updates</h2>
          <Link href="/admin/posts" className="text-sm text-muted-foreground hover:text-foreground">
            View all posts
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {latestPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet. Create your first post.</p>
          ) : (
            latestPosts.map((post) => (
              <Link
                key={post.id}
                href={`/admin/posts/${post.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3 text-sm hover:bg-muted/60"
              >
                <div className="space-y-1">
                  <p className="font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(post.updatedAt)} · {post.status.toLowerCase()}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Edit →</span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
