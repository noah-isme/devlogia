#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { logger } from "@/lib/logger";

type Format = "csv" | "markdown";

const prisma = new PrismaClient();

function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => JSON.stringify(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function toMarkdown(rows: Array<Record<string, string | number>>) {
  if (!rows.length) {
    return "No tenant analytics available.";
  }
  const headers = Object.keys(rows[0]);
  const headerRow = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((header) => row[header]).join(" | ")} |`);
  return [headerRow, divider, ...body].join("\n");
}

async function main() {
  const format = (process.argv.find((arg) => arg.startsWith("--format="))?.split("=")[1] ?? "csv") as Format;
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.split("=")[1];

  const analytics = await prisma.tenantAnalytics.findMany({
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { revenue: "desc" },
  });

  const rows = analytics.map((record) => ({
    tenant: record.tenant.name,
    slug: record.tenant.slug,
    visits: record.visits,
    aiUsageUsd: Number(record.aiUsage),
    revenueUsd: Number(record.revenue),
    federationShare: record.federationShare.toFixed(2),
    updatedAt: record.updatedAt.toISOString(),
  }));

  const content = format === "markdown" ? toMarkdown(rows) : toCsv(rows);

  if (outputArg) {
    const target = resolve(process.cwd(), outputArg);
    writeFileSync(target, content, "utf8");
    logger.info({ format, target }, "analytics report written");
  } else {
    process.stdout.write(content);
  }

  await prisma.$disconnect();
}

void main();
