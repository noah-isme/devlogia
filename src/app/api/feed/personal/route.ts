import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recordRequestMetrics } from "@/lib/metrics";
import { getPersonalizedFeed } from "@/lib/personalization/feed";
import { isDatabaseEnabled } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const contextPostId = url.searchParams.get("postId") ?? undefined;
  const forceRefresh = url.searchParams.get("refresh") === "1";
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  if (!isDatabaseEnabled) {
    return NextResponse.json({ items: [], message: "Database unavailable" }, { status: 503 });
  }

  const feed = await getPersonalizedFeed({
    userId,
    limit,
    contextPostId,
    forceRefresh,
  });

  const durationMs = Date.now() - startedAt;
  recordRequestMetrics({ status: 200, durationMs });

  const response = NextResponse.json(feed, {
    headers: {
      "Cache-Control": "private, max-age=60",
      "X-Personalization-Segment": feed.segment ?? "unknown",
      "X-Personalization-Cache": feed.cache,
    },
  });

  return response;
}
