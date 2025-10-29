import { BillingAccountStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { tenantConfig } from "@/lib/tenant";

import { getStripeClient } from "./stripe";

type EnsureStripeCustomerOptions = {
  tenantId: string;
  email?: string | null;
  name?: string | null;
};

export async function getOrCreateBillingAccount(tenantId: string) {
  const existing = await prisma.billingAccount.findUnique({ where: { tenantId } });
  if (existing) {
    return existing;
  }

  logger.info({ tenantId }, "Creating billing account placeholder");
  return prisma.billingAccount.create({
    data: {
      tenantId,
      status: BillingAccountStatus.INACTIVE,
    },
  });
}

export async function ensureStripeCustomer(options: EnsureStripeCustomerOptions) {
  const account = await getOrCreateBillingAccount(options.tenantId);
  if (account.stripeCustomerId) {
    return account;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: options.email ?? undefined,
    name: options.name ?? undefined,
    metadata: {
      tenantId: options.tenantId,
    },
  });

  return prisma.billingAccount.update({
    where: { id: account.id },
    data: {
      stripeCustomerId: customer.id,
      status: BillingAccountStatus.ACTIVE,
    },
  });
}

type EnsureConnectAccountOptions = {
  tenantId: string;
  email?: string | null;
  businessName?: string | null;
  businessUrl?: string | null;
  tosAcceptanceIp?: string | null;
};

export async function ensureConnectAccount(options: EnsureConnectAccountOptions) {
  const account = await getOrCreateBillingAccount(options.tenantId);
  if (account.connectAccountId) {
    return account;
  }

  if (!tenantConfig.billing.stripeSecretKey) {
    throw new Error("Stripe secret key must be configured before creating Connect accounts");
  }

  const stripe = getStripeClient();
  const created = await stripe.accounts.create({
    type: "express",
    email: options.email ?? undefined,
    business_profile: {
      name: options.businessName ?? undefined,
      url: options.businessUrl ?? undefined,
      product_description: "Devlogia marketplace author",
    },
    metadata: {
      tenantId: options.tenantId,
    },
    tos_acceptance:
      options.tosAcceptanceIp && options.tosAcceptanceIp.length > 0
        ? { ip: options.tosAcceptanceIp, date: Math.floor(Date.now() / 1000) }
        : undefined,
  });

  logger.info({ tenantId: options.tenantId, connectAccountId: created.id }, "Provisioned Stripe Connect account");

  const existingMetadata =
    account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? (account.metadata as Prisma.JsonObject)
      : {};

  return prisma.billingAccount.update({
    where: { id: account.id },
    data: {
      connectAccountId: created.id,
      status: BillingAccountStatus.ACTIVE,
      metadata: {
        ...existingMetadata,
        connectOnboardedAt: new Date().toISOString(),
      },
    },
  });
}

type CreateOnboardingLinkInput = {
  tenantId: string;
  returnUrl: string;
  refreshUrl: string;
  email?: string | null;
  businessName?: string | null;
  businessUrl?: string | null;
  tosAcceptanceIp?: string | null;
};

export async function createConnectOnboardingLink(input: CreateOnboardingLinkInput) {
  const account = await ensureConnectAccount({
    tenantId: input.tenantId,
    email: input.email,
    businessName: input.businessName,
    businessUrl: input.businessUrl,
    tosAcceptanceIp: input.tosAcceptanceIp,
  });

  if (!account.connectAccountId) {
    throw new Error("Unable to resolve connect account for onboarding link");
  }

  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: account.connectAccountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding",
  });

  return {
    url: link.url,
    expiresAt: link.expires_at ? new Date(link.expires_at * 1000) : null,
    connectAccountId: account.connectAccountId,
  };
}
