import Link from "next/link";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { listWorkspaces } from "@/lib/collaboration/workspace";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "Collaboration Workspaces",
  description: "Manage real-time collaboration rooms and monitor presence.",
});

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function parseSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeStatus(status: string | null | undefined) {
  switch (status) {
    case "ONLINE":
      return "Online";
    case "IDLE":
      return "Idle";
    case "DISCONNECTED":
      return "Disconnected";
    default:
      return "Unknown";
  }
}

export default async function WorkspacesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Authentication required</p>
        <p>
          Please <Link href="/admin/login" className="underline">sign in</Link> to access collaboration dashboards.
        </p>
      </div>
    );
  }

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Database unavailable</p>
        <p>Configure the DATABASE_URL environment variable to enable workspace collaboration.</p>
      </div>
    );
  }

  const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const selectedTenantId = parseSearchParam(searchParams?.tenantId) ?? tenants[0]?.id ?? null;
  const query = (parseSearchParam(searchParams?.query) ?? "").trim().toLowerCase();

  if (!selectedTenantId) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No tenants found</p>
        <p>Create a tenant to configure collaboration workspaces.</p>
      </div>
    );
  }

  const workspaces = await listWorkspaces({ tenantId: selectedTenantId });

  const filtered = query
    ? workspaces.filter((workspace) =>
        `${workspace.name} ${workspace.slug}`.toLowerCase().includes(query),
      )
    : workspaces;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold">Collaboration dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review workspace membership, active sessions, and real-time presence health.
          </p>
        </div>
        <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end" method="get">
          <label className="flex w-full flex-col gap-1 text-sm sm:w-64">
            <span className="font-medium text-muted-foreground">Tenant</span>
            <select
              name="tenantId"
              defaultValue={selectedTenantId}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name ?? tenant.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-sm sm:w-72">
            <span className="font-medium text-muted-foreground">Search</span>
            <input
              type="search"
              name="query"
              defaultValue={query}
              placeholder="Filter by workspace name"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Apply filters
          </button>
        </form>
      </header>

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Workspaces ({filtered.length})</h2>
          <span className="text-xs text-muted-foreground">
            Updated {filtered.length ? formatDate(filtered[0]?.createdAt ?? new Date()) : "recently"}
          </span>
        </header>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Workspace</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Members</th>
                <th className="px-4 py-3 text-center">Active session</th>
                <th className="px-4 py-3 text-left">Presence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No workspaces match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((workspace) => {
                  const session = workspace.sessions[0];
                  const presence = session?.presence ?? [];
                  const online = presence.filter((entry) => entry.status === "ONLINE").length;
                  const idle = presence.filter((entry) => entry.status === "IDLE").length;
                  const lastSeen = presence.reduce<Date | null>((latest, entry) => {
                    const timestamp = entry.lastSeenAt ?? null;
                    if (!timestamp) return latest;
                    const value = new Date(timestamp);
                    if (!latest || value.getTime() > latest.getTime()) {
                      return value;
                    }
                    return latest;
                  }, null);
                  return (
                    <tr key={workspace.id}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{workspace.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Created {formatDate(workspace.createdAt)} by {workspace.creator.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{workspace.slug}</td>
                      <td className="px-4 py-3 text-center text-foreground">{workspace.members.length}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {session ? formatDate(session.startedAt) : "No active session"}
                      </td>
                      <td className="px-4 py-3">
                        {presence.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No active collaborators</span>
                        ) : (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">{online}</span> online / {idle} idle
                            </p>
                            <p>Last activity {lastSeen ? formatDate(lastSeen) : "Unknown"}</p>
                            <div className="flex flex-wrap gap-2">
                              {presence.slice(0, 4).map((entry) => (
                                <span key={entry.userId} className="rounded-full bg-muted px-2 py-1">
                                  {normalizeStatus(entry.status)}
                                </span>
                              ))}
                              {presence.length > 4 ? (
                                <span className="rounded-full bg-muted px-2 py-1">+{presence.length - 4}</span>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
