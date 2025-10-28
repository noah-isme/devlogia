import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { type AICompletionUsage, type ModerationResult } from "@/lib/ai/types";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { initRedis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?<!\w)(?:\+?\d[\d\s\-]{7,}\d)(?!\w)/g;
const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";

export type ModerationPhase = "prompt" | "completion";

export function maskSensitiveContent(value: string): string {
  return value.replace(EMAIL_REGEX, "[redacted-email]").replace(PHONE_REGEX, "[redacted-phone]");
}

export async function moderateContent(text: string, phase: ModerationPhase): Promise<ModerationResult> {
  const provider = (process.env.MODERATION_PROVIDER || "none").toLowerCase();
  if (!text.trim()) {
    return { flagged: false };
  }
  if (provider !== "openai") {
    return { flagged: false };
  }
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { flagged: false };
  }
  const response = await fetch(MODERATION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: process.env.MODERATION_MODEL || "text-moderation-latest", input: text.slice(0, 8192) }),
  });
  if (!response.ok) {
    return { flagged: false };
  }
  type OpenAIModeration = {
    results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
  };
  const data = (await response.json()) as OpenAIModeration;
  const flagged = Boolean(data.results?.some((result) => result.flagged));
  const categories = flagged
    ? Object.entries(data.results?.[0]?.categories ?? {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
    : undefined;
  return { flagged, categories, reason: flagged ? `Blocked by moderation during ${phase}` : undefined } satisfies ModerationResult;
}

export async function recordAIUsage({
  userId,
  postId,
  task,
  model,
  provider,
  usage,
}: {
  userId: string;
  postId?: string | null;
  task: string;
  model: string;
  provider: string;
  usage: AICompletionUsage;
}) {
  if (!isDatabaseEnabled) {
    return;
  }
  try {
    await prisma.aIUsage.create({
      data: {
        userId,
        postId: postId ?? null,
        task,
        model,
        provider,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        usd: new Prisma.Decimal(usage.costUsd || 0),
      },
    });
  } catch (error) {
    console.error("Failed to record AI usage", error);
  }
}

export async function recordAuditLog({
  userId,
  postId,
  task,
  prompt,
  model,
  provider,
  tokens,
  moderated,
}: {
  userId?: string | null;
  postId?: string | null;
  task: string;
  prompt: string;
  model: string;
  provider: string;
  tokens: number;
  moderated: boolean;
}) {
  if (!isDatabaseEnabled) {
    return;
  }
  const hash = createHash("sha256").update(prompt).digest("hex");
  try {
    await prisma.aIAuditLog.create({
      data: {
        userId: userId ?? null,
        postId: postId ?? null,
        task,
        promptHash: hash,
        promptExcerpt: prompt.slice(0, 200),
        model,
        provider,
        tokens,
        moderated,
      },
    });
  } catch (error) {
    console.error("Failed to record AI audit log", error);
  }
}

export async function getMonthlyUsageUsd(userId: string): Promise<number> {
  if (!isDatabaseEnabled) {
    return 0;
  }
  try {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const aggregate = await prisma.aIUsage.aggregate({
      where: { userId, createdAt: { gte: start } },
      _sum: { usd: true },
    });
    const usd = aggregate._sum.usd;
    return usd ? Number(usd) : 0;
  } catch (error) {
    console.error("Failed to aggregate AI usage", error);
    return 0;
  }
}

export async function enforceMonthlyBudget({ userId, additionalCost }: { userId: string; additionalCost: number }) {
  const budget = Number(process.env.AI_COST_BUDGET_MONTH_USD ?? "0");
  if (!budget) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, limit: budget } as const;
  }
  const spent = await getMonthlyUsageUsd(userId);
  const remaining = budget - spent;
  if (remaining < additionalCost) {
    return { allowed: false as const, remaining: Math.max(0, remaining), limit: budget };
  }
  return { allowed: true as const, remaining: remaining - additionalCost, limit: budget };
}

export async function cacheDeterministicResult<T>(key: string, value: T, ttlSeconds = 3600) {
  const redis = await initRedis();
  if (!redis) {
    return;
  }
  try {
    await redis.set(`ai-cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error("Failed to cache AI result", error);
  }
}

export async function getDeterministicCache<T>(key: string): Promise<T | null> {
  const redis = await initRedis();
  if (!redis) {
    return null;
  }
  try {
    const value = await redis.get(`ai-cache:${key}`);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to read AI cache", error);
    return null;
  }
}

export async function enforceCreatorRateLimit(userId: string) {
  const limit = 30;
  const windowMs = 30 * 60 * 1000;
  const result = await checkRateLimit(`ai:${userId}`, limit, windowMs);
  return result;
}
