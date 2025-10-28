import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AIPrivacyForm } from "@/components/admin/AIPrivacyForm";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { getPrivacyPreferences } from "@/lib/personalization/privacy";

export const metadata: Metadata = buildMetadata({
  title: "AI Privacy",
  description: "Control personalization, analytics anonymization, and insight exports.",
});

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "superadmin") {
    redirect("/admin/dashboard");
  }
  const preferences = await getPrivacyPreferences(session.user.id);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">AI Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Configure personalization opt-outs, anonymize telemetry, and export aggregated insights on demand.
        </p>
      </header>
      <AIPrivacyForm initial={preferences} />
    </div>
  );
}
