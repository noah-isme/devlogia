import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAIProvider } from "@/lib/ai/provider";
import {
  cacheDeterministicResult,
  enforceCreatorRateLimit,
  enforceMonthlyBudget,
  getDeterministicCache,
  maskSensitiveContent,
  moderateContent,
  recordAIUsage,
  recordAuditLog,
} from "@/lib/ai/guardrails";
import { type SeoSuggestion } from "@/lib/ai/types";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";
import { auth } from "@/lib/auth";
import { prisma, isDatabaseEnabled } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { slugify } from "@/lib/utils";

const requestSchema = z.object({
  postId: z.string().optional(),
  title: z.string().min(3),
  summary: z.string().optional(),
  content: z.string().min(20),
  language: z.string().optional(),
});

export async function POST(request: Request) {
  const providerName = (process.env.AI_PROVIDER || "none").toLowerCase();
  if (providerName === "none") {
    return NextResponse.json({ error: "AI assistant disabled" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  const rateLimit = await enforceCreatorRateLimit(session.user.id);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "AI rate limit exceeded" }, { status: 429, headers: buildRateLimitHeaders(rateLimit, 30) });
  }

  const provider = resolveAIProvider();
  const cacheKey = createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  const cached = await getDeterministicCache<{ suggestion: SeoSuggestion; usage: { tokensIn: number; tokensOut: number; costUsd: number } }>(`seo:${cacheKey}`);
  if (cached) {
    const response = await buildSeoResponse({
      suggestion: cached.suggestion,
      usage: cached.usage,
      rateLimit,
      cached: true,
    });
    return response;
  }

  const masked = maskSensitiveContent(`${payload.title}\n${payload.summary ?? ""}\n${payload.content}`);
  const moderation = await moderateContent(masked, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "seo",
      prompt: masked,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json({ error: "Request blocked by moderation" }, { status: 422 });
  }

  try {
    const result = await provider.optimizeSeo(payload);
    const suggestion = await ensureSeoValidity(result.suggestion, payload.postId);
    const budget = await enforceMonthlyBudget({ userId: session.user.id, additionalCost: result.usage.costUsd });

    await cacheDeterministicResult(`seo:${cacheKey}`, { suggestion, usage: result.usage }, 12 * 3600);

    await recordAIUsage({
      userId: session.user.id,
      postId: payload.postId,
      task: "seo",
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: result.usage,
    });

    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "seo",
      prompt: masked,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
      moderated: false,
    });

    const response = await buildSeoResponse({
      suggestion,
      usage: result.usage,
      rateLimit,
      budget,
    });

    return response;
  } catch (error) {
    console.error("AI SEO optimizer failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

async function buildSeoResponse({
  suggestion,
  usage,
  rateLimit,
  budget,
  cached = false,
}: {
  suggestion: SeoSuggestion & { validation?: { slugAvailable: boolean; conflictingTitles: Array<{ id: string; title: string; similarity: number }> } };
  usage: { tokensIn: number; tokensOut: number; costUsd: number };
  rateLimit: { remaining: number; reset: number };
  budget?: Awaited<ReturnType<typeof enforceMonthlyBudget>>;
  cached?: boolean;
}) {
  const response = NextResponse.json({ suggestion, usage, cached }, { status: 200 });
  response.headers.set("X-AI-Usage-Tokens-In", String(usage.tokensIn ?? 0));
  response.headers.set("X-AI-Usage-Tokens-Out", String(usage.tokensOut ?? 0));
  response.headers.set("X-AI-Cost-USD", usage.costUsd ? usage.costUsd.toFixed(6) : "0");
  Object.entries(buildRateLimitHeaders(rateLimit, 30)).forEach(([key, value]) => response.headers.set(key, value));

  if (budget) {
    response.headers.set("X-AI-Budget-Limit", String(budget.limit ?? 0));
    response.headers.set(
      "X-AI-Budget-Remaining",
      Number.isFinite(budget.remaining) ? String(Math.max(0, Math.round(budget.remaining))) : "-1",
    );
    if (!budget.allowed) {
      response.headers.set("X-AI-Budget-Status", "exceeded");
    } else if (budget.limit && budget.limit > 0) {
      const spent = budget.limit - (budget.remaining ?? 0);
      if (budget.limit > 0 && spent / budget.limit >= 0.8) {
        response.headers.set("X-AI-Budget-Status", "warning");
      }
    }
  }

  return response;
}

async function ensureSeoValidity(suggestion: SeoSuggestion, postId?: string) {
  const validated = { ...suggestion };
  validated.title = validated.title.slice(0, 60);
  validated.metaDescription = validated.metaDescription.slice(0, 155);
  validated.slug = slugify(validated.slug).slice(0, 80);

  const validation = { slugAvailable: true, conflictingTitles: [] as Array<{ id: string; title: string; similarity: number }> };

  if (isDatabaseEnabled) {
    try {
      const existing = await prisma.post.findFirst({
        where: {
          slug: validated.slug,
          NOT: postId ? { id: postId } : undefined,
        },
        select: { id: true },
      });
      if (existing) {
        validation.slugAvailable = false;
        validated.slug = uniqueSlug(validated.slug);
      }

      const posts = await prisma.post.findMany({
        where: postId ? { id: { not: postId } } : undefined,
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      const baseEmbedding = await generateEmbedding(validated.title);
      const conflicts: Array<{ id: string; title: string; similarity: number }> = [];
      for (const post of posts) {
        const targetEmbedding = await generateEmbedding(post.title);
        const similarity = cosineSimilarity(baseEmbedding.vector, targetEmbedding.vector);
        if (similarity >= 0.82) {
          conflicts.push({ id: post.id, title: post.title, similarity: Number(similarity.toFixed(3)) });
        }
      }
      validation.conflictingTitles = conflicts;
    } catch (error) {
      console.error("SEO validation failed", error);
    }
  }

  return { ...validated, validation } as SeoSuggestion & {
    validation: {
      slugAvailable: boolean;
      conflictingTitles: Array<{ id: string; title: string; similarity: number }>;
    };
  };
}

function uniqueSlug(base: string) {
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

function buildRateLimitHeaders(result: { remaining: number; reset: number }, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "X-RateLimit-Reset": String(result.reset),
  };
}
