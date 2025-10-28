import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { getCreatorInsightSnapshot } from "@/lib/personalization/insights";

export const metadata: Metadata = buildMetadata({
  title: "AI Insights",
  description: "Predictive performance insights for upcoming Devlogia content.",
});

export default async function AiInsightsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  const snapshot = await getCreatorInsightSnapshot(20);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">AI predictive insights</h1>
        <p className="text-sm text-muted-foreground">
          Forecast click-through rates, dwell time, and engagement probability before you publish.
        </p>
      </header>
      <nav className="flex gap-4 text-sm">
        <Link href="/admin/insights" className="text-muted-foreground hover:text-foreground">
          Overview
        </Link>
        <Link href="/admin/insights/ai" className="font-medium text-foreground">
          AI predictions
        </Link>
      </nav>
      <section className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Upcoming performance</h2>
            <p className="text-xs text-muted-foreground">Model: {snapshot.model} · Updated {new Date(snapshot.refreshedAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Post</th>
                <th className="px-3 py-2">Predicted CTR</th>
                <th className="px-3 py-2">Dwell (s)</th>
                <th className="px-3 py-2">Engagement probability</th>
                <th className="px-3 py-2">Drivers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {snapshot.posts.map((post) => (
                <tr key={post.postId} className="hover:bg-background/60">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{post.title}</div>
                    <div className="text-xs text-muted-foreground">/blog/{post.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-sm">{(post.predictedCtr * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-sm">{post.predictedDwellSeconds}</td>
                  <td className="px-3 py-2 text-sm">{(post.predictedEngagementProbability * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{post.topDrivers.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
