import Stripe from "stripe";

import { tenantConfig } from "@/lib/tenant";

let stripeClient: Stripe | null = null;

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2024-06-20";

export function getStripeClient(): Stripe {
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
