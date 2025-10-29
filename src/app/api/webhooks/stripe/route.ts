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

    return NextResponse.json({ status: result.status, plan: result.plan ?? null });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
