import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Analytics",
  description: "Monitor Devlogia performance metrics in real-time.",
});

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Analytics overview</h1>
        <p className="text-sm text-muted-foreground">
          Track post engagement, user activity, and trending tags with 30-second refreshes.
        </p>
      </header>
      <AnalyticsDashboard />
    </div>
  );
}
