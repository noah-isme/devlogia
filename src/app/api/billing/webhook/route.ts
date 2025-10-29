import { NextRequest, NextResponse } from "next/server";

import { processStripeWebhook } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  try {
    const result = await processStripeWebhook({ payload, signature });
    return NextResponse.json({ status: result.status }, { status: 200 });
  } catch (error) {
    logger.error({ error }, "Failed to process Stripe webhook event");
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
