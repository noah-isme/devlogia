import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.aIUsageLog.groupBy({
    by: ["moderationStatus"],
    _count: { _all: true },
  });

  if (!counts.length) {
    console.log("No AI usage moderation data available.");
    return;
  }

  const rows = counts.map((entry) => ({
    status: entry.moderationStatus ?? "unknown",
    count: entry._count._all,
  }));

  console.table(rows);
}

main()
  .catch((error) => {
    console.error("Failed to generate AI moderation report", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
