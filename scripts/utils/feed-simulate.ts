#!/usr/bin/env tsx
import process from "node:process";

import { getPersonalizedFeed } from "@/lib/personalization/feed";

function parseArgs(argv: string[]) {
  const args: { userId: string | null; limit?: number } = { userId: null };
  for (const arg of argv) {
    if (arg.startsWith("--user=")) {
      args.userId = arg.slice("--user=".length);
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value)) args.limit = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userId) {
    console.error("Usage: pnpm feed:simulate --user=<user-id> [--limit=6]");
    process.exitCode = 1;
    return;
  }

  const feed = await getPersonalizedFeed({
    userId: args.userId,
    limit: args.limit,
    fallbackLimit: Math.max(args.limit ?? 6, 6),
    forceRefresh: true,
  });
  console.log(`Segment: ${feed.segment ?? "unknown"}`);
  console.log(`Cache status: ${feed.cache}`);
  console.log(`Fallback used: ${feed.fallback}`);
  console.log("Items:");
  feed.items.forEach((item, index) => {
    console.log(
      `${index + 1}. ${item.title} (${(item.score * 100).toFixed(1)}%) — ${item.reason.join(", ")} [${item.slug}]`,
    );
  });
}

main().catch((error) => {
  console.error("feed:simulate failed", error);
  process.exitCode = 1;
});
