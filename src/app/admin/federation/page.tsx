import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FederationDashboard } from "@/components/admin/FederationDashboard";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Federation",
  description: "Monitor global recommendation performance across Devlogia tenants.",
});

export default async function FederationPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/admin/dashboard");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Federation insights</h1>
        <p className="text-sm text-muted-foreground">
          Track cross-tenant recommendation health, latency, and trending topics with near real-time telemetry.
        </p>
      </header>
      <FederationDashboard />
    </div>
  );
}
