import Link from "next/link";

import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";
import { listAIExtensions } from "@/lib/ai/extensions";
import { getTenantQuotaStatus } from "@/lib/ai/quota";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const metadata = buildMetadata({
  title: "AI Extension Hub",
  description: "Manage tenant AI extensions and monitor usage quotas.",
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

function formatTokens(tokens: number) {
  return tokens.toLocaleString();
}

export default async function AiExtensionHubPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Authentication required</p>
        <p>
          Please <Link href="/admin/login" className="underline">sign in</Link> to manage AI extensions.
        </p>
      </div>
    );
  }

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Database unavailable</p>
        <p>Configure the DATABASE_URL environment variable to enable the AI Extension Hub.</p>
      </div>
    );
  }

  const tenants = await prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const selectedTenantId = parseSearchParam(searchParams?.tenantId) ?? tenants[0]?.id ?? null;
  const query = (parseSearchParam(searchParams?.query) ?? "").trim().toLowerCase();
  const includeInactive = parseSearchParam(searchParams?.includeInactive) === "true";

  if (!selectedTenantId) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No tenants found</p>
        <p>Create a tenant to start publishing AI extensions.</p>
      </div>
    );
  }

  const [extensions, quota] = await Promise.all([
    listAIExtensions({ tenantId: selectedTenantId, includeInactive }),
    getTenantQuotaStatus(selectedTenantId),
  ]);

  const filteredExtensions = query
    ? extensions.filter((extension) =>
        `${extension.name} ${extension.provider} ${extension.model}`.toLowerCase().includes(query),
      )
    : extensions;

  const utilization = quota.limit ? Math.min(1, quota.used / quota.limit) : 0;
  const utilizationPercent = Math.round(utilization * 100);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold">AI Extension Hub</h1>
          <p className="text-sm text-muted-foreground">
            Manage AI capabilities available to your tenant teams and monitor monthly quota consumption.
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
              placeholder="Filter by name, provider, or model"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="includeInactive" value="true" defaultChecked={includeInactive} />
            Show inactive
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Apply filters
          </button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly usage</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatTokens(quota.used)} tokens</p>
          <p className="text-xs text-muted-foreground">
            {quota.limit ? `${formatTokens(quota.limit)} token plan` : "Unlimited quota"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {quota.limit ? `${formatTokens(Math.max(0, quota.limit - quota.used))} tokens` : "Unlimited"}
          </p>
          <p className="text-xs text-muted-foreground">Updated in real-time from usage logs.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Utilization</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${utilizationPercent}%` }} />
            </div>
            <span className="text-sm font-medium text-foreground">{utilizationPercent}%</span>
          </div>
          {quota.warnings.length ? (
            <p className="mt-2 text-xs text-amber-600">
              {quota.warnings[0]?.message ?? "Quota warning active."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Extensions ({filteredExtensions.length})</h2>
          <span className="text-xs text-muted-foreground">
            Updated {filteredExtensions.length ? formatDate(filteredExtensions[0]?.updatedAt ?? new Date()) : "recently"}
          </span>
        </header>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Capability</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-right">Monthly tokens</th>
                <th className="px-4 py-3 text-right">Monthly cost</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredExtensions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No extensions match the current filters.
                  </td>
                </tr>
              ) : (
                filteredExtensions.map((extension) => (
                  <tr key={extension.id}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{extension.name}</span>
                        {extension.description ? (
                          <span className="text-xs text-muted-foreground">{extension.description}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{extension.capability.toLowerCase()}</td>
                    <td className="px-4 py-3 uppercase text-muted-foreground">{extension.provider}</td>
                    <td className="px-4 py-3 text-muted-foreground">{extension.model}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatTokens(extension.monthlyTokens)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      ${(extension.monthlyCostCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          extension.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {extension.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
