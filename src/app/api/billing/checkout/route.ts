import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createStripeCheckoutSession } from "@/lib/billing/stripe";
import { tenantConfig } from "@/lib/tenant";

const requestSchema = z.object({
  tenantId: z.string().min(3),
  plan: z.enum(["pro", "enterprise"] as const),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !session.user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tenantConfig.billing || tenantConfig.billing.provider !== "stripe") {
    return NextResponse.json({ error: "Stripe billing is not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const checkoutSession = await createStripeCheckoutSession({
      tenantId: parsed.data.tenantId,
      plan: parsed.data.plan,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
      customerEmail: session.user.email ?? undefined,
    });

    return NextResponse.json({ id: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout session creation failed", error);
    return NextResponse.json({ error: "Checkout session failed" }, { status: 500 });
  }
}
