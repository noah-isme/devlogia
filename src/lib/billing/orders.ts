import crypto from "node:crypto";

import { OrderStatus, PayoutStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { tenantConfig } from "@/lib/tenant";

import { getOrCreateBillingAccount } from "./accounts";

export type RevenueSplitAmounts = {
  platformPct: number;
  authorPct: number;
  tenantPct: number;
  platformAmountCents: number;
  authorAmountCents: number;
  tenantAmountCents: number;
};

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 10_000) / 10_000;
}

export function calculateRevenueSplit(totalCents: number, platformPct: number, tenantPct = 0): RevenueSplitAmounts {
  const normalizedPlatform = clampPercentage(platformPct);
  const normalizedTenant = clampPercentage(Math.min(tenantPct, 1 - normalizedPlatform));
  const authorPct = clampPercentage(1 - normalizedPlatform - normalizedTenant);

  const platformAmount = Math.round(totalCents * normalizedPlatform);
  const tenantAmount = Math.round(totalCents * normalizedTenant);
  const authorAmount = totalCents - platformAmount - tenantAmount;

  return {
    platformPct: normalizedPlatform,
    authorPct,
    tenantPct: normalizedTenant,
    platformAmountCents: platformAmount,
    authorAmountCents: authorAmount,
    tenantAmountCents: tenantAmount,
  };
}

export function createOrderIdempotencyKey(paymentIntentId: string | null | undefined) {
  if (!paymentIntentId) {
    return null;
  }
  return crypto.createHash("sha256").update(paymentIntentId).digest("hex");
}

type CreatePaidOrderInput = {
  tenantId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  taxCents?: number;
  currency: string;
  paymentIntentId?: string | null;
  metadata?: Prisma.JsonObject;
  connectAccountId?: string | null;
  billingAccountId?: string | null;
};

export async function recordPaidOrder(input: CreatePaidOrderInput) {
  const totalBeforeTax = input.unitPriceCents * input.quantity;
  const taxCents = input.taxCents ?? 0;
  const totalCents = totalBeforeTax + taxCents;
  const platformPct = tenantConfig.billing.platformFeePercentage;
  const split = calculateRevenueSplit(totalCents, platformPct);
  const invoiceNumber = `${tenantConfig.billing.invoicePrefix}-${Date.now().toString(36)}`;

  const billingAccount = input.billingAccountId
    ? await prisma.billingAccount.findUnique({ where: { id: input.billingAccountId } })
    : await getOrCreateBillingAccount(input.tenantId);

  if (!billingAccount) {
    throw new Error("Unable to resolve billing account for order creation");
  }

  const idempotencyKey = createOrderIdempotencyKey(input.paymentIntentId);

  return prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.order.findFirst({
        where: { paymentIntentId: input.paymentIntentId ?? undefined },
        include: { revenueSplit: true },
      });
      if (existing) {
        logger.info({ paymentIntentId: input.paymentIntentId }, "Order already processed for payment intent");
        return { order: existing, revenueSplit: existing.revenueSplit };
      }
    }

    const order = await tx.order.create({
      data: {
        tenantId: input.tenantId,
        productId: input.productId,
        billingAccountId: billingAccount.id,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        totalCents,
        taxCents,
        status: OrderStatus.PAID,
        paymentIntentId: input.paymentIntentId ?? null,
        invoiceNumber,
        metadata: input.metadata ?? {},
      },
    });

    const revenueSplit = await tx.revenueSplit.create({
      data: {
        orderId: order.id,
        platformPct: split.platformPct,
        authorPct: split.authorPct,
        tenantPct: split.tenantPct,
        platformAmountCents: split.platformAmountCents,
        authorAmountCents: split.authorAmountCents,
        tenantAmountCents: split.tenantAmountCents,
        settled: false,
      },
    });

    if (input.connectAccountId) {
      const payout = await tx.payout.create({
        data: {
          billingAccountId: billingAccount.id,
          connectAccountId: input.connectAccountId,
          amountCents: split.authorAmountCents,
          currency: input.currency,
          status: split.authorAmountCents > 0 ? PayoutStatus.PENDING : PayoutStatus.PAID,
          metadata: {
            productId: input.productId,
            orderId: order.id,
          },
        },
      });

      await tx.revenueSplit.update({
        where: { id: revenueSplit.id },
        data: {
          payoutId: payout.id,
        },
      });
    }

    return { order, revenueSplit };
  });
}
