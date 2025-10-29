import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import type { TenantPlanTier } from "@/lib/tenant";
import { tenantConfig } from "@/lib/tenant";

import { calculatePlanLimits, findPlanByPrice, resolvePlanConfiguration } from "./plans";

let stripeClient: Stripe | null = null;

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2024-06-20";

function getStripeClient(): Stripe {
  if (!tenantConfig.billing.stripeSecretKey) {
    throw new Error("Stripe secret key is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(tenantConfig.billing.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: "Devlogia Billing", version: "1.0.0" },
    });
  }

  return stripeClient;
}

type CheckoutSessionInput = {
  tenantId: string;
  plan: TenantPlanTier;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
};

export async function createStripeCheckoutSession(input: CheckoutSessionInput) {
  const { plan, priceId } = resolvePlanConfiguration(input.plan);

  if (plan === "free") {
    throw new Error("Free plan does not require a Stripe checkout session");
  }

  if (!priceId) {
    throw new Error(`Stripe price ID is not configured for the ${plan} plan`);
  }

  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    customer_email: input.customerEmail ?? undefined,
    metadata: {
      tenantId: input.tenantId,
      plan,
    },
    subscription_data: {
      metadata: {
        tenantId: input.tenantId,
        plan,
      },
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
  });
}

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

export async function handleStripeEvent(event: Stripe.Event) {
  if (!event?.type) {
    return { status: "ignored" } as const;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const planResolution = resolvePlanFromCheckoutSession(session);

    if (!planResolution) {
      return { status: "ignored" } as const;
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

  return { status: "ignored" } as const;
}

export async function processStripeWebhook(context: StripeWebhookContext) {
  const event = await parseStripeWebhook(context);
  return handleStripeEvent(event);
}
