import { prisma } from "@/lib/prisma";
import { markdownToReportBuffer } from "@/lib/pdf";

export type RevenueFilters = {
  tenantId?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
};

export type RevenueSummary = {
  totals: {
    grossCents: number;
    taxCents: number;
    platformCents: number;
    authorCents: number;
    tenantCents: number;
    orders: number;
  };
  orders: Array<{
    id: string;
    tenantId: string;
    productId: string;
    productName: string;
    type: string;
    totalCents: number;
    taxCents: number;
    currency: string;
    createdAt: Date;
    status: string;
    platformAmountCents: number;
    authorAmountCents: number;
    tenantAmountCents: number;
    invoiceNumber: string | null;
  }>;
};

export async function getRevenueSummary(filters: RevenueFilters = {}): Promise<RevenueSummary> {
  const where: Record<string, unknown> = {};
  if (filters.tenantId) {
    where.tenantId = filters.tenantId;
  }
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: { product: true, revenueSplit: true },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 100,
  });

  let grossCents = 0;
  let taxCents = 0;
  let platformCents = 0;
  let authorCents = 0;
  let tenantCents = 0;

  const mapped = orders.map((order) => {
    const metadata = order.product?.metadata;
    let productName = order.product?.id ?? order.productId;
    if (metadata && typeof metadata === "object") {
      const candidate = (metadata as Record<string, unknown>).name;
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        productName = candidate;
      }
    }

    grossCents += order.totalCents;
    taxCents += order.taxCents;
    if (order.revenueSplit) {
      platformCents += order.revenueSplit.platformAmountCents;
      authorCents += order.revenueSplit.authorAmountCents;
      tenantCents += order.revenueSplit.tenantAmountCents;
    }

    return {
      id: order.id,
      tenantId: order.tenantId,
      productId: order.productId,
      productName,
      type: order.product?.type ?? "unknown",
      totalCents: order.totalCents,
      taxCents: order.taxCents,
      currency: order.product?.currency ?? "usd",
      createdAt: order.createdAt,
      status: order.status,
      platformAmountCents: order.revenueSplit?.platformAmountCents ?? 0,
      authorAmountCents: order.revenueSplit?.authorAmountCents ?? 0,
      tenantAmountCents: order.revenueSplit?.tenantAmountCents ?? 0,
      invoiceNumber: order.invoiceNumber,
    };
  });

  return {
    totals: {
      grossCents,
      taxCents,
      platformCents,
      authorCents,
      tenantCents,
      orders: orders.length,
    },
    orders: mapped,
  };
}

function toCurrency(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

export function buildRevenueCsv(summary: RevenueSummary) {
  const header = [
    "order_id",
    "tenant_id",
    "product_id",
    "product_name",
    "type",
    "total",
    "tax",
    "platform_share",
    "author_share",
    "tenant_share",
    "currency",
    "invoice",
    "created_at",
  ];

  const rows = summary.orders.map((order) => [
    order.id,
    order.tenantId,
    order.productId,
    order.productName,
    order.type,
    toCurrency(order.totalCents),
    toCurrency(order.taxCents),
    toCurrency(order.platformAmountCents),
    toCurrency(order.authorAmountCents),
    toCurrency(order.tenantAmountCents),
    order.currency,
    order.invoiceNumber ?? "",
    order.createdAt.toISOString(),
  ]);

  return [header, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function buildRevenueReport(summary: RevenueSummary, format: "csv" | "pdf" | "markdown" = "markdown") {
  if (format === "csv") {
    const csv = buildRevenueCsv(summary);
    return { buffer: Buffer.from(csv, "utf8"), contentType: "text/csv" } as const;
  }

  const markdownLines = [
    "# Devlogia Revenue Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Total orders: ${summary.totals.orders}`,
    `Gross merchandise volume: $${toCurrency(summary.totals.grossCents)}`,
    `Platform share: $${toCurrency(summary.totals.platformCents)}`,
    `Author share: $${toCurrency(summary.totals.authorCents)}`,
    `Tenant share: $${toCurrency(summary.totals.tenantCents)}`,
    "",
    "| Order | Tenant | Product | Total | Platform | Author | Tenant | Created |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summary.orders.map((order) =>
      [
        order.id,
        order.tenantId,
        order.productId,
        `$${toCurrency(order.totalCents)}`,
        `$${toCurrency(order.platformAmountCents)}`,
        `$${toCurrency(order.authorAmountCents)}`,
        `$${toCurrency(order.tenantAmountCents)}`,
        order.createdAt.toISOString(),
      ].join(" | "),
    ),
  ];

  const markdown = markdownLines.join("\n");
  return markdownToReportBuffer(markdown, format === "pdf" ? "pdf" : "markdown");
}
