import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveAIProvider } from "@/lib/ai/provider";
import {
  enforceCreatorRateLimit,
  enforceMonthlyBudget,
  maskSensitiveContent,
  moderateContent,
  recordAIUsage,
  recordAuditLog,
} from "@/lib/ai/guardrails";
import { type TonePreset } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";

const requestSchema = z.object({
  postId: z.string().optional(),
  content: z.string().min(20),
  preset: z.enum(["Technical Guide", "Narrative Devlog", "Brief Note"]).optional(),
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
  const masked = maskSensitiveContent(payload.content);
  const moderation = await moderateContent(masked, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "tone",
      prompt: masked,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json({ error: "Request blocked by moderation" }, { status: 422 });
  }

  try {
    const result = await provider.analyzeTone(payload.content, payload.preset as TonePreset | undefined);
    const budget = await enforceMonthlyBudget({ userId: session.user.id, additionalCost: result.usage.costUsd });

    await recordAIUsage({
      userId: session.user.id,
      postId: payload.postId,
      task: "tone",
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: result.usage,
    });

    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: "tone",
      prompt: masked,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
      moderated: false,
    });

    const response = NextResponse.json({ analysis: result.analysis, usage: result.usage }, { status: 200 });
    response.headers.set("X-AI-Usage-Tokens-In", String(result.usage.tokensIn ?? 0));
    response.headers.set("X-AI-Usage-Tokens-Out", String(result.usage.tokensOut ?? 0));
    response.headers.set("X-AI-Cost-USD", result.usage.costUsd ? result.usage.costUsd.toFixed(6) : "0");
    response.headers.set("X-AI-Budget-Limit", String(budget.limit ?? 0));
    response.headers.set(
      "X-AI-Budget-Remaining",
      Number.isFinite(budget.remaining) ? String(Math.max(0, Math.round(budget.remaining))) : "-1",
    );
    Object.entries(buildRateLimitHeaders(rateLimit, 30)).forEach(([key, value]) => response.headers.set(key, value));

    if (!budget.allowed) {
      response.headers.set("X-AI-Budget-Status", "exceeded");
    } else if (budget.limit && budget.limit > 0) {
      const spent = budget.limit - (budget.remaining ?? 0);
      if (budget.limit > 0 && spent / budget.limit >= 0.8) {
        response.headers.set("X-AI-Budget-Status", "warning");
      }
    }

    return response;
  } catch (error) {
    console.error("AI tone analyzer failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

function buildRateLimitHeaders(result: { remaining: number; reset: number }, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "X-RateLimit-Reset": String(result.reset),
  };
}
