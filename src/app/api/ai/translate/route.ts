import { NextResponse } from "next/server";
import { z } from "zod";

import { translateMdxDocument, type SupportedLanguageCode } from "@/lib/ai/mdx-translator";
import {
  enforceCreatorRateLimit,
  enforceMonthlyBudget,
  maskSensitiveContent,
  moderateContent,
  recordAIUsage,
  recordAuditLog,
} from "@/lib/ai/guardrails";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";

const requestSchema = z.object({
  postId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  contentMdx: z.string().min(1),
  targetLanguage: z.enum(["id", "es", "fr", "de", "ja", "zh", "en"] satisfies SupportedLanguageCode[]),
});

export async function POST(request: Request) {
  const providerName = (process.env.AI_PROVIDER || "none").toLowerCase();

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
    return NextResponse.json(
      { error: "AI rate limit exceeded" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": String(Math.max(0, Math.floor(rateLimit.remaining))),
          "X-RateLimit-Reset": String(rateLimit.reset),
        },
      },
    );
  }

  const maskedPrompt = maskSensitiveContent(JSON.stringify(payload));
  const moderation = await moderateContent(maskedPrompt, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: `translate_${payload.targetLanguage}`,
      prompt: maskedPrompt,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json({ error: "Request blocked by moderation" }, { status: 422 });
  }

  try {
    const translation = await translateMdxDocument({
      title: payload.title,
      summary: payload.summary,
      contentMdx: payload.contentMdx,
      targetLanguage: payload.targetLanguage,
    });

    const moderationOutput = await moderateContent(translation.contentMdx, "completion");
    if (moderationOutput.flagged) {
      await recordAuditLog({
        userId: session.user.id,
        postId: payload.postId,
        task: `translate_${payload.targetLanguage}`,
        prompt: maskedPrompt,
        model: providerName,
        provider: providerName,
        tokens: translation.usage.tokensIn + translation.usage.tokensOut,
        moderated: true,
      });
      return NextResponse.json({ error: "Generated output failed moderation" }, { status: 422 });
    }

    const budget = await enforceMonthlyBudget({
      userId: session.user.id,
      additionalCost: translation.usage.costUsd,
    });

    await recordAIUsage({
      userId: session.user.id,
      postId: payload.postId,
      task: `translate_${payload.targetLanguage}`,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: translation.usage,
    });

    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: `translate_${payload.targetLanguage}`,
      prompt: maskedPrompt,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: translation.usage.tokensIn + translation.usage.tokensOut,
      moderated: false,
    });

    return NextResponse.json(
      {
        title: translation.title,
        summary: translation.summary,
        contentMdx: translation.contentMdx,
        targetLanguage: translation.targetLanguage,
        languageName: translation.languageName,
        usage: translation.usage,
        budget: {
          remaining: budget.remaining,
          status: !budget.allowed ? "exceeded" : undefined,
        },
      },
      {
        headers: {
          "X-AI-Usage-Tokens-In": String(translation.usage.tokensIn ?? 0),
          "X-AI-Usage-Tokens-Out": String(translation.usage.tokensOut ?? 0),
          "X-AI-Cost-USD": translation.usage.costUsd ? translation.usage.costUsd.toFixed(6) : "0",
        },
      },
    );
  } catch (error) {
    console.error("AI translation failed", error);
    return NextResponse.json({ error: "AI translation request failed" }, { status: 502 });
  }
}
