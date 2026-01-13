import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  month?: string;
  user?: string;
};

function parseArgs(): CliOptions {
  const options: CliOptions = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--month=")) {
      options.month = arg.slice("--month=".length);
    } else if (arg.startsWith("--user=")) {
      options.user = arg.slice("--user=".length);
    }
  }
  return options;
}

function resolveInterval(monthArg?: string) {
  const now = monthArg ? new Date(`${monthArg}-01T00:00:00Z`) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid month value: ${monthArg}`);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

async function main() {
  const { month, user } = parseArgs();
  const { start, end } = resolveInterval(month);
  const usage = await prisma.aIUsage.groupBy({
    by: ["userId", "model", "provider"],
    where: {
      createdAt: {
        gte: start,
        lt: end,
      },
      ...(user ? { userId: user } : {}),
    },
    _sum: {
      usd: true,
      tokensIn: true,
      tokensOut: true,
    },
    orderBy: {
      _sum: {
        usd: "desc",
      },
    },
  });

  if (!usage.length) {
    console.log("No AI usage records found for interval", start.toISOString(), "-", end.toISOString());
    return;
  }

  const rows = usage.map((item) => ({
    userId: item.userId,
    model: item.model,
    provider: item.provider,
    usd: item._sum.usd ? Number(item._sum.usd).toFixed(4) : "0.0000",
    tokensIn: item._sum.tokensIn ?? 0,
    tokensOut: item._sum.tokensOut ?? 0,
  }));

  console.table(rows);
}

main()
  .catch((error) => {
    console.error("Failed to build AI usage report", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
