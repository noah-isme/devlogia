import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { getAllApiKeys } from "@/lib/security/api-keys";
import { ApiKeyManager } from "@/components/admin/ApiKeyManager";

export const metadata = buildMetadata({
  title: "API Keys & Access Tokens",
  description: "Issue and manage scoped API keys and environment tokens.",
});

export default async function ApiKeysPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (session.user.role !== "superadmin" && session.user.role !== "admin" && session.user.role !== "tenantAdmin") {
    redirect("/admin/dashboard");
  }

  const allKeys = getAllApiKeys().map((k) => ({
    ...k,
    key: k.displayKey,
  }));

  return (
    <div className="space-y-6">
      <ApiKeyManager initialKeys={allKeys} />
    </div>
  );
}
