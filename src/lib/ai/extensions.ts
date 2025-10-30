import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { applyQuotaUsage, getTenantQuotaStatus, type QuotaApplicationResult } from "@/lib/ai/quota";

const providerSchema = z.enum(["openai", "anthropic", "huggingface"] as const);
const capabilitySchema = z.enum(["writer", "optimizer", "seo", "summarizer"] as const);

type Provider = z.infer<typeof providerSchema>;
type Capability = z.infer<typeof capabilitySchema>;

const extensionMetadataSchema = z.record(z.string(), z.any());

export const aiExtensionInputSchema = z
  .object({
    tenantId: z.string().cuid(),
    ownerId: z.string().cuid().optional(),
    name: z.string().min(3).max(191),
    provider: providerSchema.default("openai"),
    model: z.string().min(2).max(191),
    capability: capabilitySchema,
    tokenCost: z.number().int().min(0).max(1_000_000).default(0),
    description: z.string().max(512).optional(),
    metadata: extensionMetadataSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export type AIExtensionInput = z.infer<typeof aiExtensionInputSchema>;

const extensionListOptionsSchema = z.object({
  tenantId: z.string().cuid(),
  includeInactive: z.boolean().optional(),
});

export type AIExtensionListOptions = z.infer<typeof extensionListOptionsSchema>;

const usageLogSchema = z
  .object({
    tenantId: z.string().cuid(),
    userId: z.string().cuid(),
    extensionId: z.string().cuid(),
    tokensUsed: z.number().int().min(0).max(10_000_000).default(0),
    costCents: z.number().int().min(0).max(10_000_000).default(0),
    promptSummary: z.string().max(256).optional(),
    moderationStatus: z.enum(["safe", "flagged", "blocked"]).optional(),
  })
  .strict();

export type AIUsageLogInput = z.infer<typeof usageLogSchema>;

export type TenantAIExtension = {
  id: string;
  tenantId: string;
  ownerId: string | null;
  name: string;
  provider: Provider;
  model: string;
  capability: Capability;
  tokenCost: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  monthlyTokens: number;
  monthlyCostCents: number;
  totalInvocations: number;
};

export type UsageLogResult = {
  logId: string | null;
  quota: QuotaApplicationResult;
};

const toJson = (value?: Record<string, unknown>): Prisma.InputJsonValue | undefined =>
  value as Prisma.InputJsonValue | undefined;

export async function createAIExtension(payload: unknown): Promise<TenantAIExtension> {
  const parsed = aiExtensionInputSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    const error = new Error("Database is not available");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  const metadata = toJson(parsed.metadata);
  const extension = await prisma.aIExtension.create({
    data: {
      tenantId: parsed.tenantId,
      ownerId: parsed.ownerId ?? null,
      name: parsed.name.trim(),
      provider: parsed.provider.toUpperCase() as Prisma.AIExtensionCreateInput["provider"],
      model: parsed.model.trim(),
      capability: parsed.capability.toUpperCase() as Prisma.AIExtensionCreateInput["capability"],
      tokenCost: parsed.tokenCost,
      description: parsed.description?.trim() ?? null,
      active: parsed.active ?? true,
      ...(metadata !== undefined ? { metadata } : {}),
    },
    include: {
      _count: { select: { usageLogs: true } },
    },
  });

  return {
    id: extension.id,
    tenantId: extension.tenantId,
    ownerId: extension.ownerId,
    name: extension.name,
    provider: extension.provider.toLowerCase() as Provider,
    model: extension.model,
    capability: extension.capability.toLowerCase() as Capability,
    tokenCost: extension.tokenCost,
    description: extension.description,
    metadata: (extension.metadata as Record<string, unknown> | null) ?? null,
    active: extension.active,
    createdAt: extension.createdAt,
    updatedAt: extension.updatedAt,
    monthlyTokens: 0,
    monthlyCostCents: 0,
    totalInvocations: extension._count.usageLogs,
  } satisfies TenantAIExtension;
}

function normalizeExtension(
  extension: Prisma.AIExtensionGetPayload<{
    include: {
      _count: { select: { usageLogs: true } };
    };
  }>,
  monthlyUsage: Map<string, { tokens: number; costCents: number }>,
): TenantAIExtension {
  const usage = monthlyUsage.get(extension.id) ?? { tokens: 0, costCents: 0 };
  return {
    id: extension.id,
    tenantId: extension.tenantId,
    ownerId: extension.ownerId,
    name: extension.name,
    provider: extension.provider.toLowerCase() as Provider,
    model: extension.model,
    capability: extension.capability.toLowerCase() as Capability,
    tokenCost: extension.tokenCost,
    description: extension.description,
    metadata: (extension.metadata as Record<string, unknown> | null) ?? null,
    active: extension.active,
    createdAt: extension.createdAt,
    updatedAt: extension.updatedAt,
    monthlyTokens: usage.tokens,
    monthlyCostCents: usage.costCents,
    totalInvocations: extension._count.usageLogs,
  } satisfies TenantAIExtension;
}

export async function listAIExtensions(options: AIExtensionListOptions): Promise<TenantAIExtension[]> {
  const parsed = extensionListOptionsSchema.parse(options);
  if (!isDatabaseEnabled) {
    return [];
  }

  const { tenantId, includeInactive } = parsed;
  const where = includeInactive ? { tenantId } : { tenantId, active: true };
  const [extensions, usage] = await Promise.all([
    prisma.aIExtension.findMany({
      where,
      include: { _count: { select: { usageLogs: true } } },
      orderBy: { createdAt: "desc" },
    }),
    (() => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return prisma.aIUsageLog.groupBy({
        by: ["extensionId"],
        where: {
          tenantId,
          createdAt: { gte: start },
        },
        _sum: { tokensUsed: true, costCents: true },
      });
    })(),
  ]);

  const usageMap = new Map<string, { tokens: number; costCents: number }>();
  for (const entry of usage) {
    usageMap.set(entry.extensionId, {
      tokens: entry._sum.tokensUsed ?? 0,
      costCents: entry._sum.costCents ?? 0,
    });
  }

  return extensions.map((extension) => normalizeExtension(extension, usageMap));
}

export async function logAIExtensionUsage(payload: unknown): Promise<UsageLogResult> {
  const parsed = usageLogSchema.parse(payload ?? {});
  if (!isDatabaseEnabled) {
    logger.warn({ tenantId: parsed.tenantId }, "AI usage log skipped because database is disabled");
    const quota = {
      status: await getTenantQuotaStatus(parsed.tenantId),
      triggered: [],
    } satisfies QuotaApplicationResult;
    return { logId: null, quota } satisfies UsageLogResult;
  }

  const extension = await prisma.aIExtension.findFirst({
    where: {
      id: parsed.extensionId,
      tenantId: parsed.tenantId,
      active: true,
    },
    select: { id: true, tenantId: true },
  });

  if (!extension) {
    const error = new Error("Extension is not active or not found for tenant");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const quota = await applyQuotaUsage(parsed.tenantId, parsed.tokensUsed);

  const log = await prisma.aIUsageLog.create({
    data: {
      tenantId: parsed.tenantId,
      userId: parsed.userId,
      extensionId: parsed.extensionId,
      tokensUsed: parsed.tokensUsed,
      costCents: parsed.costCents,
      promptSummary: parsed.promptSummary?.slice(0, 256) ?? null,
      moderationStatus: parsed.moderationStatus ?? null,
    },
    select: { id: true },
  });

  return { logId: log.id, quota } satisfies UsageLogResult;
}
