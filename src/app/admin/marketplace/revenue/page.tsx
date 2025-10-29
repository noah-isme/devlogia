import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RevenueDashboard } from "@/components/admin/RevenueDashboard";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Marketplace revenue",
  description: "Track Devlogia marketplace GMV, platform fees, and payouts.",
});

export default async function MarketplaceRevenuePage() {
  const session = await auth();
  if (!session?.user || (!can(session.user, "billing:manage") && !can(session.user, "billing:view"))) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Marketplace revenue</h1>
        <p className="text-sm text-muted-foreground">
          Review orders, revenue split, and payouts across all plugins and extensions.
        </p>
      </header>
      <RevenueDashboard />
    </div>
  );
}
