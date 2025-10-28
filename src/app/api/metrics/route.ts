import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import type { MetricsSnapshot } from "@/lib/metrics";
import { getMetricsSnapshot } from "@/lib/metrics";

function hasValidApiKey(request: NextRequest) {
  const configured = process.env.METRICS_API_KEY;
  if (!configured) {
    return false;
  }

  const provided = request.headers.get("x-metrics-key");
  if (!provided) {
    return false;
  }

  try {
    const configuredBuffer = Buffer.from(configured);
    const providedBuffer = Buffer.from(provided);
    if (configuredBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(configuredBuffer, providedBuffer);
  } catch {
    return false;
  }
}

async function ensureAuthorized(request: NextRequest) {
  if (hasValidApiKey(request)) {
    return true;
  }

  const session = await auth();
  if (session?.user?.role === "superadmin") {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const authorized = await ensureAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot: MetricsSnapshot = getMetricsSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
