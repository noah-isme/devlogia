import { Prisma } from "@prisma/client";

import { recordAIUsage, recordAuditLog } from "@/lib/ai/guardrails";
import { resolveAIProvider } from "@/lib/ai/provider";
import { logger } from "@/lib/logger";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { initRedis } from "@/lib/redis";
import { blendHighlights } from "@/lib/personalization/metrics";
import type { SummaryResult } from "@/lib/personalization/types";
import { clamp } from "@/lib/utils";

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

const SUMMARY_VERSION = 2;

export async function getPostSummary(
  slug: string,
  options: { userId?: string | null; force?: boolean } = {},
): Promise<SummaryResult | null> {
  if (!isDatabaseEnabled) {
    return null;
  }

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { contentVector: true },
  });

  if (!post) {
    return null;
  }

  const redis = await initRedis();
  const key = `summary:v${SUMMARY_VERSION}:${post.id}:${post.updatedAt.getTime()}`;

  if (!options.force && redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as SummaryResult;
        return { ...parsed, cached: true } satisfies SummaryResult;
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed to read summary cache");
    }
  }

  const provider = resolveAIProvider();
  const paragraphs = 3;
  const highlightsCount = 5;
  const result = await provider.summarize({
    title: post.title,
    content: post.contentMdx,
    paragraphs,
    highlights: highlightsCount,
  });

  const summaryText = result.summary.trim() || post.summary || post.contentMdx.slice(0, 480);
  const highlights = result.highlights.length ? result.highlights : blendHighlights(summaryText);
  const payload: SummaryResult = {
    summary: summaryText,
    highlights,
    model: result.model ?? process.env.AI_MODEL_SUMMARIZER ?? process.env.AI_MODEL ?? "gpt-4o-mini",
    cached: false,
    generatedAt: new Date().toISOString(),
  };

  if (redis) {
    try {
      const ttlHours = Number(process.env.AI_PERSONALIZATION_TTL_HOURS ?? "6");
      const ttlSeconds = clamp(Math.round(ttlHours * 3600), 900, 48 * 3600);
      await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
    } catch (error) {
      logger.warn({ err: error }, "Failed to cache summary");
    }
  }

  if (options.userId) {
    try {
      await recordAIUsage({
        userId: options.userId,
        postId: post.id,
        task: "summary",
        model: payload.model,
        provider: process.env.AI_PROVIDER ?? "none",
        usage: result.usage,
      });
    } catch (error) {
      logger.warn({ err: error }, "Failed to record summary usage");
    }
  }

  try {
    await recordAuditLog({
      userId: options.userId ?? null,
      postId: post.id,
      task: "summary",
      prompt: `summary:${slug}:v${SUMMARY_VERSION}`,
      model: payload.model,
      provider: process.env.AI_PROVIDER ?? "none",
      tokens: result.usage.tokensOut + result.usage.tokensIn,
      moderated: false,
    });
  } catch (error) {
    logger.warn({ err: error }, "Failed to record summary audit log");
  }

  try {
    await prisma.contentVector.upsert({
      where: { postId: post.id },
      create: {
        postId: post.id,
        embedding: toJson(post.contentVector?.embedding ?? []),
        topicTags: toJson(post.contentVector?.topicTags ?? []),
        engagementScore: post.contentVector?.engagementScore ?? 0,
        freshnessScore: post.contentVector?.freshnessScore ?? 0,
        highlights: toJson(highlights),
      },
      update: {
        highlights: toJson(highlights),
      },
    });
  } catch (error) {
    logger.warn({ err: error }, "Failed to persist summary highlights");
  }

  return payload;
}
