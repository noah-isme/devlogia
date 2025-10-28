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
import { type OutlineResult } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";

const requestSchema = z.object({
  postId: z.string().optional(),
  topic: z.string().min(3),
  summary: z.string().optional(),
  tags: z.array(z.string().min(1)).max(20).optional(),
  relatedPosts: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
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
  const cached = await getDeterministicCache<{ outline: OutlineResult; usage: { tokensIn: number; tokensOut: number; costUsd: number } }>(`outline:${cacheKey}`);
  if (cached) {
    const response = NextResponse.json({ outline: cached.outline, mdx: outlineToMdx(cached.outline), usage: cached.usage, cached: true }, { status: 200 });
    Object.entries(buildRateLimitHeaders(rateLimit, 30)).forEach(([key, value]) => response.headers.set(key, value));
    response.headers.set("X-AI-Usage-Tokens-In", String(cached.usage.tokensIn ?? 0));
    response.headers.set("X-AI-Usage-Tokens-Out", String(cached.usage.tokensOut ?? 0));
    response.headers.set("X-AI-Cost-USD", cached.usage.costUsd ? cached.usage.costUsd.toFixed(6) : "0");
    return response;
  }

  const masked = maskSensitiveContent(`${payload.topic}\n${payload.summary ?? ""}`);
  const moderation = await moderateContent(masked, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "outline",
      prompt: masked,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json({ error: "Request blocked by moderation" }, { status: 422 });
  }

  try {
    const result = await provider.generateOutline(payload);
    const budget = await enforceMonthlyBudget({ userId: session.user.id, additionalCost: result.usage.costUsd });

    await cacheDeterministicResult(`outline:${cacheKey}`, result, 6 * 3600);

    await recordAIUsage({
      userId: session.user.id,
      postId: payload.postId,
      task: "outline",
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: result.usage,
    });

    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "outline",
      prompt: masked,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
      moderated: false,
    });

    const response = NextResponse.json(
      { outline: result.outline, mdx: outlineToMdx(result.outline), usage: result.usage, cached: false },
      { status: 200 },
    );
    Object.entries(buildRateLimitHeaders(rateLimit, 30)).forEach(([key, value]) => response.headers.set(key, value));
    response.headers.set("X-AI-Usage-Tokens-In", String(result.usage.tokensIn ?? 0));
    response.headers.set("X-AI-Usage-Tokens-Out", String(result.usage.tokensOut ?? 0));
    response.headers.set("X-AI-Cost-USD", result.usage.costUsd ? result.usage.costUsd.toFixed(6) : "0");
    if (budget.limit) {
      response.headers.set("X-AI-Budget-Limit", String(budget.limit));
      response.headers.set(
        "X-AI-Budget-Remaining",
        Number.isFinite(budget.remaining) ? String(Math.max(0, Math.round(budget.remaining))) : "-1",
      );
      if (!budget.allowed) {
        response.headers.set("X-AI-Budget-Status", "exceeded");
      } else if (budget.limit > 0) {
        const spent = budget.limit - (budget.remaining ?? 0);
        if (spent / budget.limit >= 0.8) {
          response.headers.set("X-AI-Budget-Status", "warning");
        }
      }
    }

    return response;
  } catch (error) {
    console.error("AI outline generator failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

function outlineToMdx(outline: OutlineResult) {
  const sections = outline.sections
    .map((section) => {
      const heading = `## ${section.heading}`;
      const bullets = section.bullets.map((item) => `- ${item}`).join("\n");
      return `${heading}\n\n${bullets ? `${bullets}\n\n` : ""}`;
    })
    .join("\n");
  const intro = outline.introduction ? `${outline.introduction}\n\n` : "";
  const conclusion = outline.conclusion ? `\n## Conclusion\n\n- ${outline.conclusion}` : "";
  return `${intro}${sections}${conclusion}`.trim();
}

function buildRateLimitHeaders(result: { remaining: number; reset: number }, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "X-RateLimit-Reset": String(result.reset),
  };
}
