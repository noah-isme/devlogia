import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  isRateLimitBypassed,
  parseRateLimit,
  resolveRateLimitKey,
} from "@/lib/ratelimit";

const provider = (process.env.NEWSLETTER_PROVIDER ?? "").trim().toLowerCase();
const subscribeRateLimit = parseRateLimit(process.env.SUBSCRIBE_RATE_LIMIT, 10);
const subscribeRateWindow = parseRateLimit(process.env.SUBSCRIBE_RATE_LIMIT_WINDOW_MS, 60_000);

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export async function POST(request: Request) {
  const identifier = resolveRateLimitKey(request, "subscribe-anonymous");
  const rateKey = `subscribe:${identifier}`;
  const bypass = isRateLimitBypassed(request);
  const rateResult = await checkRateLimit(rateKey, subscribeRateLimit, subscribeRateWindow, { bypass });
  const rateHeaders = buildRateLimitHeaders(rateResult, subscribeRateLimit);

  if (!rateResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateHeaders });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please provide a valid email." }, { status: 400, headers: rateHeaders });
  }

  if (!provider) {
    return NextResponse.json({ error: "Newsletter provider is not configured." }, { status: 503, headers: rateHeaders });
  }

  try {
    if (provider === "buttondown") {
      const apiKey = process.env.BUTTONDOWN_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Buttondown API key missing." }, { status: 500, headers: rateHeaders });
      }

      const response = await fetch("https://api.buttondown.email/v1/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok && response.status !== 409) {
        const detail = await response.text();
        console.error("Buttondown subscription failed", detail);
        return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 502, headers: rateHeaders });
      }
    } else if (provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      const audienceId = process.env.RESEND_AUDIENCE_ID;
      if (!apiKey || !audienceId) {
        return NextResponse.json({ error: "Resend configuration incomplete." }, { status: 500, headers: rateHeaders });
      }

      const response = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok && response.status !== 409) {
        const detail = await response.text();
        console.error("Resend subscription failed", detail);
        return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 502, headers: rateHeaders });
      }
    } else {
      return NextResponse.json({ error: "Unsupported provider." }, { status: 400, headers: rateHeaders });
    }

    return NextResponse.json({ ok: true }, { headers: rateHeaders });
  } catch (error) {
    logger.error({ err: error }, "Newsletter subscription failed");
    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500, headers: rateHeaders });
  }
}
