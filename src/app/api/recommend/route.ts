import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommendations";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  const query = url.searchParams.get("query");
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const preferences = url.searchParams.getAll("preference");

  const response = await getRecommendations({
    postId,
    query,
    limit,
    userPreferences: preferences.length ? preferences : undefined,
  });

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": response.cache === "hit" ? "private, max-age=300" : "no-store",
      "X-Recommendation-Latency": String(response.latencyMs),
      "X-Recommendation-Fallback": response.fallback ? "1" : "0",
    },
  });
}
