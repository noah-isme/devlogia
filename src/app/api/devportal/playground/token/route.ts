import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  parseRateLimit,
  resolveRateLimitKey,
} from "@/lib/ratelimit";

const requestSchema = z.object({
  scopes: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? "anonymous";
  const limit = parseRateLimit(process.env.DEVPORTAL_RATE_LIMIT_RPM, 120);
  const rateKey = `devportal:playground:${userId}:${resolveRateLimitKey(request, userId)}`;
  const rate = await checkRateLimit(rateKey, limit, 60_000);
  const rateHeaders = buildRateLimitHeaders(rate, limit);

  if (!rate.success) {
    return NextResponse.json({ error: "Sandbox token rate limit exceeded" }, { status: 429, headers: rateHeaders });
  }

  const sandboxKey = request.headers.get("x-devportal-sandbox-key");
  const expectedKey = process.env.DEVPORTAL_SANDBOX_API_KEY;
  if (expectedKey && sandboxKey && sandboxKey !== expectedKey) {
    return NextResponse.json({ error: "Invalid sandbox key" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const payload = requestSchema.safeParse(body);
  const now = Date.now();
  const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();

  const token = randomBytes(24).toString("hex");

  return NextResponse.json(
    {
      token,
      expiresAt,
      scopes: payload.success ? payload.data.scopes ?? [] : [],
    },
    { headers: rateHeaders },
  );
}
