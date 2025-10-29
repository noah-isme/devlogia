import { buildRevenueReport, getRevenueSummary } from "../src/lib/billing/revenue";

async function main() {
  const format = (process.argv[2] ?? "markdown").toLowerCase();
  const tenantId = process.argv[3];

  const summary = await getRevenueSummary({ tenantId: tenantId ?? undefined });

  if (format === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (format === "csv" || format === "pdf") {
    const report = buildRevenueReport(summary, format as "csv" | "pdf");
    const output = format === "pdf" ? report.buffer.toString("base64") : report.buffer.toString("utf8");
    console.log(output);
    return;
  }

  const report = buildRevenueReport(summary, "markdown");
  console.log(report.buffer.toString("utf8"));
}

main().catch((error) => {
  console.error("Failed to build billing report", error);
  process.exitCode = 1;
});
