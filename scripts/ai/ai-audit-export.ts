import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Options = {
  from?: string;
  to?: string;
  format: "json" | "csv";
};

function parseOptions(): Options {
  const options: Options = { format: "json" };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--from=")) {
      options.from = arg.slice("--from=".length);
    } else if (arg.startsWith("--to=")) {
      options.to = arg.slice("--to=".length);
    } else if (arg === "--csv") {
      options.format = "csv";
    }
  }
  return options;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

async function main() {
  const { from, to, format } = parseOptions();
  const start = parseDate(from);
  const end = parseDate(to);
  const createdAtFilter = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } : undefined;
  const audits = await prisma.aIAuditLog.findMany({
    where: {
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  if (format === "csv") {
    const header = ["id", "userId", "postId", "task", "model", "provider", "tokens", "moderated", "createdAt", "promptHash", "promptExcerpt"].join(",");
    const rows = audits.map((item) =>
      [
        item.id,
        item.userId ?? "",
        item.postId ?? "",
        item.task,
        item.model,
        item.provider,
        item.tokens,
        item.moderated ? "true" : "false",
        item.createdAt.toISOString(),
        item.promptHash,
        JSON.stringify(item.promptExcerpt ?? ""),
      ].join(","),
    );
    console.log([header, ...rows].join("\n"));
  } else {
    console.log(JSON.stringify(audits, null, 2));
  }
}

main()
  .catch((error) => {
    console.error("Failed to export AI audit logs", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
