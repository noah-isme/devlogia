import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InsightsDashboard } from "@/components/admin/InsightsDashboard";
import { InsightsReportGenerator } from "@/components/admin/InsightsReportGenerator";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Insights",
  description: "Real-time engagement analytics, AI summaries, and reader sentiment trends.",
});

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Reader engagement insights</h1>
        <p className="text-sm text-muted-foreground">
          Monitor behavioral analytics, sentiment shifts, and generate weekly AI summaries for your editorial team.
        </p>
      </header>
      <nav className="flex gap-4 text-sm">
        <Link href="/admin/insights" className="font-medium text-foreground">
          Overview
        </Link>
        <Link href="/admin/insights/ai" className="text-muted-foreground hover:text-foreground">
          AI predictions
        </Link>
      </nav>
      <InsightsDashboard range={30} />
      <InsightsReportGenerator range={30} />
    </div>
  );
}
