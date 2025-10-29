import { NextResponse } from "next/server";

import { handleStripeEvent, parseStripeWebhook } from "@/lib/billing/stripe";
import { tenantConfig } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (tenantConfig.billing.provider !== "stripe") {
    return NextResponse.json({ error: "Stripe billing disabled" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  try {
    const event = await parseStripeWebhook({ payload, signature });
    const result = await handleStripeEvent(event);
    const body: Record<string, unknown> = { status: result.status };
    if ("plan" in result) {
      body.plan = result.plan ?? null;
    }

    return NextResponse.json(body);
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
