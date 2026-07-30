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
import { type WriterAction } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { verifyResearchSources } from "@/lib/news";

const requestSchema = z.object({
  postId: z.string().optional(),
  action: z.enum(["draft", "continue", "rewrite_clarity", "rewrite_concise", "translate_en", "translate_id", "draft_from_sources"] satisfies WriterAction[]),
  title: z.string().min(1),
  summary: z.string().optional(),
  tags: z.array(z.string().min(1)).max(20).optional(),
  content: z.string().optional(),
  selection: z.string().optional(),
  language: z.enum(["id", "en"]).optional(),
  targetLanguage: z.enum(["id", "en"]).optional(),
  toneGuide: z.string().optional(),
  styleGuide: z.string().optional(),
  relatedPosts: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  researchToken: z.string().max(20_000).optional(),
  sourceUrls: z.array(z.string().url()).min(1).max(6).optional(),
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
  const isSourceDraft = payload.action === "draft_from_sources";
  if (isSourceDraft && session.user.role !== "admin" && session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Only administrators can draft from current-news sources" }, { status: 403 });
  }
  const researchSources = isSourceDraft ? verifyResearchSources(payload.researchToken ?? "", payload.sourceUrls ?? []) : undefined;
  if (isSourceDraft && !researchSources) {
    return NextResponse.json({ error: "Selected research sources have expired or are invalid. Search again." }, { status: 400 });
  }

  const rateLimit = await enforceCreatorRateLimit(session.user.id);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "AI rate limit exceeded" }, { status: 429, headers: buildRateLimitHeaders(rateLimit, 30) });
  }

  const provider = resolveAIProvider();
  const maskedPrompt = maskSensitiveContent(JSON.stringify(payload));
  const moderation = await moderateContent(maskedPrompt, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: payload.action,
      prompt: maskedPrompt,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json({ error: "Request blocked by moderation" }, { status: 422 });
  }

  try {
    const completion = await provider.writer({
      ...payload,
      researchSources: researchSources ?? undefined,
      content: payload.content ?? "",
      selection: payload.selection ?? "",
    });

    const citedCompletion = researchSources?.length ? `${completion.content.replace(/\n*## Sources[\s\S]*$/i, "").trim()}\n\n## Sources\n${researchSources.map((source) => `- [${source.title}](${source.url}) — ${source.publisher}, ${new Date(source.publishedAt).toLocaleDateString("en-CA")}`).join("\n")}` : completion.content;
    const moderationOutput = await moderateContent(citedCompletion, "completion");
    if (moderationOutput.flagged) {
      await recordAuditLog({
        userId: session.user.id,
        postId: payload.postId,
        task: payload.action,
        prompt: maskedPrompt,
        model: providerName,
        provider: providerName,
        tokens: completion.usage.tokensIn + completion.usage.tokensOut,
        moderated: true,
      });
      return NextResponse.json({ error: "Generated output failed moderation" }, { status: 422 });
    }

    const budget = await enforceMonthlyBudget({ userId: session.user.id, additionalCost: completion.usage.costUsd });
    const response = new Response(streamText(citedCompletion), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-AI-Usage-Tokens-In": String(completion.usage.tokensIn ?? 0),
        "X-AI-Usage-Tokens-Out": String(completion.usage.tokensOut ?? 0),
        "X-AI-Cost-USD": completion.usage.costUsd ? completion.usage.costUsd.toFixed(6) : "0",
        "X-AI-Budget-Limit": String(budget.limit ?? 0),
        "X-AI-Budget-Remaining": Number.isFinite(budget.remaining) ? String(Math.max(0, Math.round(budget.remaining))) : "-1",
        ...buildRateLimitHeaders(rateLimit, 30),
      },
    });

    await recordAIUsage({
      userId: session.user.id,
      postId: payload.postId,
      task: payload.action,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: completion.usage,
    });

    await recordAuditLog({
      userId: session.user.id,
      postId: payload.postId,
      task: payload.action,
      prompt: maskedPrompt,
      model: process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: completion.usage.tokensIn + completion.usage.tokensOut,
      moderated: false,
    });

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
    console.error("AI writer failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

function streamText(content: string) {
  const encoder = new TextEncoder();
  const chunks = chunkContent(content);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function chunkContent(content: string) {
  const parts: string[] = [];
  const step = 256;
  for (let index = 0; index < content.length; index += step) {
    parts.push(content.slice(index, index + step));
  }
  return parts;
}

function buildRateLimitHeaders(result: { remaining: number; reset: number }, limit: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "X-RateLimit-Reset": String(result.reset),
  };
}
