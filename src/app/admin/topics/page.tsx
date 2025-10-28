import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Topics",
  description: "Automated topic clusters generated from reader engagement and embeddings.",
});

export default async function TopicsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "superadmin" && session.user.role !== "editor")) {
    redirect("/admin/dashboard");
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Topics</h1>
        <p className="text-sm text-muted-foreground">
          Database is unavailable, so topic clusters could not be loaded.
        </p>
      </div>
    );
  }

  const clusters = await prisma.topicCluster.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      posts: {
        include: {
          post: {
            select: { id: true, slug: true, title: true, summary: true, publishedAt: true },
          },
        },
        orderBy: { score: "desc" },
      },
    },
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Active topic clusters</h1>
        <p className="text-sm text-muted-foreground">
          Clusters are regenerated daily based on embedding similarity and reader interactions.
        </p>
      </header>
      {clusters.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
          No clusters detected yet. Generate embeddings and run the insights daily job to populate this view.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <article key={cluster.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <header className="mb-3">
                <h2 className="text-base font-semibold">{cluster.label}</h2>
                <p className="text-xs text-muted-foreground">
                  Keywords: {Array.isArray(cluster.keywords) ? cluster.keywords.join(", ") : String(cluster.keywords)}
                </p>
              </header>
              <ul className="space-y-2 text-sm">
                {cluster.posts.map((relation) => (
                  <li key={relation.postId} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="font-medium">{relation.post.title}</p>
                    {relation.post.summary ? (
                      <p className="text-xs text-muted-foreground">{relation.post.summary}</p>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Score: {relation.score.toFixed(2)}</span>
                      {relation.post.publishedAt ? (
                        <time dateTime={relation.post.publishedAt.toISOString()}>
                          {relation.post.publishedAt.toLocaleDateString()}
                        </time>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
