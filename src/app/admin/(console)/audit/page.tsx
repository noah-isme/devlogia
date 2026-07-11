import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { buildMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

const AUDIT_ACTIONS = [
  "post:create",
  "post:update",
  "post:publish",
  "post:unpublish",
  "post:delete",
  "page:create",
  "page:update",
  "page:publish",
  "page:unpublish",
  "page:delete",
  "user:create",
  "user:update",
  "user:role_change",
] as const;

export const metadata: Metadata = buildMetadata({
  title: "Audit trail",
  description: "Review CMS content and role changes.",
});

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  if (!can(session.user, "user:list")) {
    redirect("/admin/dashboard");
  }

  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;
  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Audit trail unavailable</p>
        <p>Configure the <code>DATABASE_URL</code> environment variable to load audit events.</p>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { action: { in: [...AUDIT_ACTIONS] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="text-sm text-muted-foreground">Create, update, publish, unpublish, delete, and role-change events.</p>
      </header>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{log.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.user?.email ?? "System"}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.targetId ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No audit events yet.</p> : null}
      </div>
    </div>
  );
}
