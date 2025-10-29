"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { RevenueSummary } from "@/lib/billing/revenue";

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat();

function formatCurrency(amountCents: number, currencyCode?: string) {
  if (!Number.isFinite(amountCents)) {
    return "-";
  }

  const formatter = currencyCode
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode.toUpperCase() })
    : currency;

  return formatter.format(amountCents / 100);
}

type FetchState = {
  status: "idle" | "loading" | "ready" | "error";
  data: RevenueSummary | null;
  error?: string;
};

export function RevenueDashboard() {
  const [state, setState] = useState<FetchState>({ status: "idle", data: null });
  const [tenantId, setTenantId] = useState("");

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const params = new URLSearchParams();
      if (tenantId.trim().length > 0) {
        params.set("tenantId", tenantId.trim());
      }
      const response = await fetch(`/api/billing/revenue${params.size ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Unable to load revenue summary");
      }
      const payload = (await response.json()) as { summary: RevenueSummary };
      setState({ status: "ready", data: payload.summary });
    } catch (error) {
      setState({ status: "error", data: null, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    if (!state.data) return [] as Array<{ id: string; label: string; value: string; description: string }>;
    const totals = state.data.totals;
    return [
      { id: "orders", label: "Orders", value: number.format(totals.orders), description: "Total completed orders" },
      {
        id: "gmv",
        label: "GMV",
        value: formatCurrency(totals.grossCents),
        description: "Gross merchandise volume",
      },
      {
        id: "platform",
        label: "Platform take",
        value: formatCurrency(totals.platformCents),
        description: "Platform fee captured",
      },
      {
        id: "authors",
        label: "Author share",
        value: formatCurrency(totals.authorCents),
        description: "Revenue payable to authors",
      },
      {
        id: "tenant",
        label: "Tenant share",
        value: formatCurrency(totals.tenantCents),
        description: "Revenue reserved for tenants",
      },
      {
        id: "tax",
        label: "Taxes collected",
        value: formatCurrency(totals.taxCents),
        description: "Reported tax totals",
      },
    ];
  }, [state.data]);

  const handleExport = useCallback(
    (format: "csv" | "pdf") => {
      const params = new URLSearchParams();
      params.set("format", format);
      if (tenantId.trim().length > 0) {
        params.set("tenantId", tenantId.trim());
      }
      const url = `/api/billing/revenue?${params.toString()}`;
      window.open(url, "_blank");
    },
    [tenantId],
  );

  return (
    <section className="space-y-6" data-testid="revenue-dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium" htmlFor="tenant-filter">
            Filter by tenant
          </label>
          <input
            id="tenant-filter"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
            placeholder="Tenant ID (optional)"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Refresh
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:bg-muted"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium shadow-sm transition hover:bg-muted"
          >
            Export PDF
          </button>
        </div>
      </div>

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Failed to load revenue summary</p>
          <p>{state.error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </div>
        ))}
        {state.status === "loading" && metrics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Loading revenue…
          </div>
        ) : null}
      </div>

      {state.data ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Order</th>
                <th className="px-4 py-2 text-left font-medium">Tenant</th>
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-left font-medium">Total</th>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                <th className="px-4 py-2 text-left font-medium">Author</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {state.data.orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-mono text-xs">{order.invoiceNumber ?? order.id}</td>
                  <td className="px-4 py-2">{order.tenantId}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{order.productName}</span>
                      <span className="text-xs text-muted-foreground">{order.productId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{formatCurrency(order.totalCents, order.currency)}</td>
                  <td className="px-4 py-2">{formatCurrency(order.platformAmountCents, order.currency)}</td>
                  <td className="px-4 py-2">{formatCurrency(order.authorAmountCents, order.currency)}</td>
                  <td className="px-4 py-2 uppercase">{order.status.toLowerCase()}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {state.data.orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No marketplace orders recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
