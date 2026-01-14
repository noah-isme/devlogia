import Stripe from "stripe";

import { OrderStatus, PayoutStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { TenantPlanTier } from "@/lib/tenant";
import { tenantConfig } from "@/lib/tenant";

import { recordPaidOrder } from "./orders";
import { calculatePlanLimits, findPlanByPrice } from "./plans";
import { syncTenantPlanQuota } from "./quota";
import { getStripeClient } from "./stripe/client";

export { createMarketplaceCheckoutSession, createStripeCheckoutSession } from "./stripe/checkout";
export { getStripeClient } from "./stripe/client";

type ApplyPlanOptions = {
  priceId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: number | null;
};

export async function applyPlanToTenant(
  tenantId: string,
  plan: TenantPlanTier,
  options: ApplyPlanOptions = {},
) {
  const limits = calculatePlanLimits(plan);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan,
      settings: {
        upsert: {
          create: {
            limits,
            planId: options.subscriptionId ?? options.priceId ?? null,
          },
          update: {
            limits,
            planId: options.subscriptionId ?? options.priceId ?? null,
          },
        },
      },
    },
  });

  await syncTenantPlanQuota(tenantId, plan);
}

type StripeWebhookContext = {
  payload: string | Buffer;
  signature: string | null;
};

export async function parseStripeWebhook({ payload, signature }: StripeWebhookContext) {
  if (!tenantConfig.billing.stripeWebhookSecret) {
    throw new Error("Stripe webhook secret is not configured");
  }

  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature ?? "", tenantConfig.billing.stripeWebhookSecret);
}

type PlanResolution = {
  tenantId: string;
  plan: TenantPlanTier;
  priceId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: number | null;
};

type SessionWithLines = Stripe.Checkout.Session & {
  line_items?: {
    data: Array<{ price?: { id?: string | null } | null }>;
  };
};

function resolvePlanFromCheckoutSession(session: SessionWithLines): PlanResolution | null {
  const tenantId = session.metadata?.tenantId ?? session.client_reference_id ?? null;
  if (!tenantId) {
    return null;
  }

  const metadataPlan = (session.metadata?.plan as TenantPlanTier | undefined) ?? null;
  if (metadataPlan) {
    return {
      tenantId,
      plan: metadataPlan,
      priceId: (session as { display_items?: Array<{ plan?: { id?: string } }> }).display_items?.[0]?.plan?.id ?? null,
      subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      currentPeriodEnd:
        typeof session.subscription !== "string" && session.subscription
          ? session.subscription.current_period_end
          : null,
    };
  }

  const priceId = session.line_items?.data[0]?.price?.id ?? null;
  const resolvedPlan = findPlanByPrice(priceId);

  if (!resolvedPlan) {
    return null;
  }

  return {
    tenantId,
    plan: resolvedPlan,
    priceId,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
    currentPeriodEnd:
      typeof session.subscription !== "string" && session.subscription
        ? session.subscription.current_period_end
        : null,
  };
}

function resolvePlanFromSubscription(subscription: Stripe.Subscription): PlanResolution | null {
  const tenantId = subscription.metadata?.tenantId ?? null;
  if (!tenantId) {
    return null;
  }

  const metadataPlan = (subscription.metadata?.plan as TenantPlanTier | undefined) ?? null;
  if (metadataPlan) {
    return {
      tenantId,
      plan: metadataPlan,
      priceId: subscription.items.data[0]?.price?.id ?? null,
      subscriptionId: subscription.id,
      currentPeriodEnd: subscription.current_period_end ?? null,
    };
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = findPlanByPrice(priceId);
  if (!plan) {
    return null;
  }

  return {
    tenantId,
    plan,
    priceId,
    subscriptionId: subscription.id,
    currentPeriodEnd: subscription.current_period_end ?? null,
  };
}

async function handleMarketplaceCheckoutSession(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenantId ?? null;
  const productId = session.metadata?.productId ?? null;

  if (!tenantId || !productId) {
    return { status: "ignored" } as const;
  }

  const quantity = Number.parseInt(session.metadata?.quantity ?? "1", 10);
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const subtotal = session.amount_subtotal ?? 0;
  const metadataUnitPrice = Number.parseInt(session.metadata?.unitPriceCents ?? "0", 10);
  const unitPriceCents = metadataUnitPrice > 0 ? metadataUnitPrice : Math.round(subtotal / safeQuantity);
  const taxCents = session.total_details?.amount_tax ?? Number.parseInt(session.metadata?.taxCents ?? "0", 10);
  const currency = session.currency ?? session.metadata?.currency ?? "usd";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const connectAccountId =
    session.metadata?.connectAccountId && session.metadata.connectAccountId.length > 0
      ? session.metadata.connectAccountId
      : undefined;

  const { order, revenueSplit } = await recordPaidOrder({
    tenantId,
    productId,
    quantity: safeQuantity,
    unitPriceCents,
    taxCents,
    currency,
    paymentIntentId,
    connectAccountId,
    metadata: {
      checkoutSessionId: session.id,
      invoiceId: typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "billing.order.recorded",
      targetId: order.id,
      meta: {
        tenantId,
        productId,
        revenueSplitId: revenueSplit?.id ?? null,
        paymentIntentId,
        amount: order.totalCents,
      },
    },
  });

  logger.info({ orderId: order.id, paymentIntentId }, "Recorded marketplace order from checkout session");
  return { status: "order-recorded", orderId: order.id } as const;
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    return { status: "ignored" } as const;
  }

  const order = await prisma.order.findFirst({ where: { paymentIntentId } });
  if (!order) {
    return { status: "ignored" } as const;
  }

  if (order.status === OrderStatus.REFUNDED) {
    return { status: "ignored" } as const;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: OrderStatus.REFUNDED },
  });

  await prisma.auditLog.create({
    data: {
      action: "billing.order.refunded",
      targetId: order.id,
      meta: {
        paymentIntentId,
        amount_refunded: charge.amount_refunded,
      },
    },
  });

  logger.warn({ orderId: order.id }, "Order marked as refunded due to Stripe charge refund");
  return { status: "order-refunded", orderId: order.id } as const;
}

async function handlePayoutPaid(payoutEvent: Stripe.Payout) {
  const destination = typeof payoutEvent.destination === "string" ? payoutEvent.destination : null;
  if (!destination) {
    return { status: "ignored" } as const;
  }

  const payout = await prisma.payout.findFirst({
    where: {
      connectAccountId: destination,
      status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] },
      amountCents: payoutEvent.amount,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!payout) {
    return { status: "ignored" } as const;
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: PayoutStatus.PAID,
      stripeTransferId: payoutEvent.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "billing.payout.settled",
      targetId: payout.id,
      meta: {
        destination,
        payoutId: payoutEvent.id,
        amount: payoutEvent.amount,
      },
    },
  });

  logger.info({ payoutId: payout.id, stripePayoutId: payoutEvent.id }, "Payout settled after Stripe payout paid");
  return { status: "payout-settled", payoutId: payout.id } as const;
}

export async function handleStripeEvent(event: Stripe.Event) {
  if (!event?.type) {
    return { status: "ignored" } as const;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const planResolution = resolvePlanFromCheckoutSession(session);

    if (!planResolution) {
      return handleMarketplaceCheckoutSession(session);
    }

    await applyPlanToTenant(planResolution.tenantId, planResolution.plan, planResolution);
    return { status: "updated", plan: planResolution.plan } as const;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const planResolution = resolvePlanFromSubscription(subscription);

    if (!planResolution) {
      return { status: "ignored" } as const;
    }

    await applyPlanToTenant(planResolution.tenantId, planResolution.plan, planResolution);
    return { status: "updated", plan: planResolution.plan } as const;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    return handleChargeRefunded(charge);
  }

  if (event.type === "payout.paid") {
    const payout = event.data.object as Stripe.Payout;
    return handlePayoutPaid(payout);
  }

  return { status: "ignored" } as const;
}

export async function processStripeWebhook(context: StripeWebhookContext) {
  const event = await parseStripeWebhook(context);
  return handleStripeEvent(event);
}
