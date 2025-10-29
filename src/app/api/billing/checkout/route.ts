import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createMarketplaceCheckoutSession } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  if (!can(session.user, "billing:checkout")) {
    return forbidden();
  }

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : null;
  const productId = typeof body?.productId === "string" ? body.productId : null;
  const successUrl = typeof body?.successUrl === "string" ? body.successUrl : null;
  const cancelUrl = typeof body?.cancelUrl === "string" ? body.cancelUrl : null;
  const quantityRaw = typeof body?.quantity === "number" ? body.quantity : Number.parseInt(body?.quantity ?? "1", 10);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;

  if (!tenantId || !productId || !successUrl || !cancelUrl) {
    return NextResponse.json({ error: "tenantId, productId, successUrl, and cancelUrl are required" }, { status: 400 });
  }

  try {
    const checkout = await createMarketplaceCheckoutSession({
      tenantId,
      productId,
      quantity,
      successUrl,
      cancelUrl,
      customerEmail: typeof body?.customerEmail === "string" ? body.customerEmail : undefined,
    });

    return NextResponse.json(
      {
        id: checkout.id,
        url: checkout.url,
        expiresAt: checkout.expires_at ? new Date(checkout.expires_at * 1000).toISOString() : null,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ error, tenantId, productId }, "Failed to create marketplace checkout session");
    const message = error instanceof Error ? error.message : "Unable to create checkout session";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
