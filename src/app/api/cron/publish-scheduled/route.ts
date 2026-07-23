import { NextResponse } from "next/server";

import { publishDueScheduledPosts } from "@/lib/cms/scheduled-publishing";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Permit unauthenticated invocation in non-production environments when CRON_SECRET is not configured
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === cronSecret) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await publishDueScheduledPosts();
    return NextResponse.json({
      success: true,
      publishedCount: result.published,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron failed to publish scheduled posts", error);
    return NextResponse.json({ error: "Failed to publish scheduled posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
