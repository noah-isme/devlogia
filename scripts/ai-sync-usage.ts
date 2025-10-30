import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getMonthWindow(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
  return { start, end };
}

async function main() {
  const { start, end } = getMonthWindow();
  const usage = await prisma.aIUsageLog.groupBy({
    by: ["tenantId"],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { tokensUsed: true, costCents: true },
    orderBy: { _sum: { tokensUsed: "desc" } },
  });

  if (!usage.length) {
    console.log("No AI usage logs found for interval", start.toISOString(), "-", end.toISOString());
    return;
  }

  const rows = usage.map((entry) => ({
    tenant: entry.tenantId,
    tokens: entry._sum.tokensUsed ?? 0,
    costUsd: ((entry._sum.costCents ?? 0) / 100).toFixed(2),
  }));
  console.table(rows);
}

main()
  .catch((error) => {
    console.error("Failed to sync AI usage", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
