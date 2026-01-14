import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import type { TenantPlanTier } from "@/lib/tenant";
import { tenantConfig } from "@/lib/tenant";

import { ensureStripeCustomer } from "../accounts";
import { resolvePlanConfiguration } from "../plans";
import { getStripeClient } from "./client";

type CheckoutSessionInput = {
  tenantId: string;
  plan: TenantPlanTier;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
};

type MarketplaceCheckoutInput = {
  tenantId: string;
  productId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
};

type MarketplaceProduct = Exclude<Awaited<ReturnType<typeof prisma.product.findUnique>>, null>;

function resolveConnectAccountId(product: MarketplaceProduct) {
  return (
    product.beneficiaryTenant?.billingAccount?.connectAccountId ||
    product.plugin?.publisherTenant?.billingAccount?.connectAccountId ||
    product.extension?.plugin.publisherTenant?.billingAccount?.connectAccountId ||
    null
  );
}

function buildMarketplaceLineItem(
  product: MarketplaceProduct,
  quantity: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  if (product.stripePriceId) {
    return { price: product.stripePriceId, quantity };
  }

  return {
    price_data: {
      currency: product.currency,
      unit_amount: product.priceCents,
      product_data: {
        name:
          product.metadata && typeof product.metadata === "object"
            ? String((product.metadata as Record<string, unknown>).name ?? `Product ${product.id}`)
            : `Product ${product.id}`,
        metadata: {
          productId: product.id,
        },
      },
    },
    quantity,
  };
}

function buildMarketplaceMetadata(options: {
  tenantId: string;
  product: MarketplaceProduct;
  quantity: number;
  connectAccountId: string | null;
}) {
  return {
    tenantId: options.tenantId,
    productId: options.product.id,
    quantity: String(options.quantity),
    unitPriceCents: String(options.product.priceCents),
    currency: options.product.currency,
    connectAccountId: options.connectAccountId ?? "",
  } satisfies Record<string, string>;
}

function buildMarketplaceSessionParams(options: {
  input: MarketplaceCheckoutInput;
  product: MarketplaceProduct;
  lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  metadata: Record<string, string>;
  connectAccountId: string | null;
  customerId: string | null;
}) {
  const isSubscription = options.product.type === "SUBSCRIPTION";
  const platformFeeAmount = Math.round(
    options.product.priceCents * options.input.quantity * tenantConfig.billing.platformFeePercentage,
  );
  const platformFeePercent = Math.round(tenantConfig.billing.platformFeePercentage * 10_000) / 100;

  return {
    mode: isSubscription ? "subscription" : "payment",
    success_url: options.input.successUrl,
    cancel_url: options.input.cancelUrl,
    automatic_tax: { enabled: true },
    billing_address_collection: "auto",
    customer: options.customerId ?? undefined,
    customer_email: options.customerId ? undefined : options.input.customerEmail ?? undefined,
    metadata: options.metadata,
    invoice_creation: {
      enabled: true,
      invoice_data: {
        metadata: {
          invoicePrefix: tenantConfig.billing.invoicePrefix,
          taxRegion: tenantConfig.billing.marketplaceTaxRegion ?? "",
        },
      },
    },
    payment_intent_data: isSubscription
      ? undefined
      : {
          application_fee_amount: platformFeeAmount,
          transfer_data: options.connectAccountId ? { destination: options.connectAccountId } : undefined,
          metadata: options.metadata,
        },
    subscription_data: isSubscription
      ? {
          metadata: options.metadata,
          transfer_data: options.connectAccountId ? { destination: options.connectAccountId } : undefined,
          application_fee_percent: platformFeePercent,
        }
      : undefined,
    line_items: [options.lineItem],
  } satisfies Stripe.Checkout.SessionCreateParams;
}

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

export async function createMarketplaceCheckoutSession(input: MarketplaceCheckoutInput) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      beneficiaryTenant: { include: { billingAccount: true } },
      plugin: { include: { publisherTenant: { include: { billingAccount: true } } } },
      extension: {
        include: {
          plugin: { include: { publisherTenant: { include: { billingAccount: true } } } },
        },
      },
    },
  });

  if (!product || !product.active) {
    throw new Error("Product is not available for purchase");
  }

  const buyerAccount = await ensureStripeCustomer({ tenantId: input.tenantId, email: input.customerEmail });
  const connectAccountId = resolveConnectAccountId(product);
  const lineItem = buildMarketplaceLineItem(product, input.quantity);
  const metadata = buildMarketplaceMetadata({ tenantId: input.tenantId, product, quantity: input.quantity, connectAccountId });
  const params = buildMarketplaceSessionParams({
    input,
    product,
    lineItem,
    metadata,
    connectAccountId,
    customerId: buyerAccount.stripeCustomerId ?? null,
  });

  const stripe = getStripeClient();
  return stripe.checkout.sessions.create(params);
}
