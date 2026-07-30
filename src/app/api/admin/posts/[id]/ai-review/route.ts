import { NextResponse } from "next/server";

import { resolveAIProvider } from "@/lib/ai/provider";
import {
  enforceCreatorRateLimit,
  enforceMonthlyBudget,
  maskSensitiveContent,
  moderateContent,
  recordAIUsage,
  recordAuditLog,
} from "@/lib/ai/guardrails";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const MAX_DRAFT_LENGTH = 12_000;

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
  const providerName = (process.env.AI_PROVIDER || "none").toLowerCase();
  if (providerName === "none") {
    return NextResponse.json(
      { error: "AI assistant disabled" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ADMIN_ROLES.has(session.user.role)) {
    return NextResponse.json(
      { error: "Only administrators can request editorial AI feedback" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      summary: true,
      contentMdx: true,
      status: true,
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (!post.contentMdx.trim()) {
    return NextResponse.json(
      { error: "Add draft content before requesting editorial AI feedback" },
      { status: 400 },
    );
  }

  const rateLimit = await enforceCreatorRateLimit(session.user.id);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "AI rate limit exceeded" },
      { status: 429, headers: buildRateLimitHeaders(rateLimit, 30) },
    );
  }

  const content = post.contentMdx.slice(0, MAX_DRAFT_LENGTH);
  const prompt = maskSensitiveContent(
    `Title: ${post.title}\nSummary: ${post.summary ?? ""}\nStatus: ${post.status}\n\nDraft:\n${content}`,
  );
  const moderation = await moderateContent(prompt, "prompt");
  if (moderation.flagged) {
    await recordAuditLog({
      userId: session.user.id,
      postId: post.id,
      task: "editorial_review",
      prompt,
      model: providerName,
      provider: providerName,
      tokens: 0,
      moderated: true,
    });
    return NextResponse.json(
      { error: "Draft blocked by moderation" },
      { status: 422 },
    );
  }

  try {
    const result = await resolveAIProvider().writer({
      action: "editorial_review",
      title: post.title,
      summary: post.summary ?? undefined,
      content,
      styleGuide:
        "Provide advisory feedback only. Human editorial approval is required before publishing.",
    });
    const review = result.content.trim();
    const outputModeration = await moderateContent(review, "completion");
    if (outputModeration.flagged) {
      await recordAuditLog({
        userId: session.user.id,
        postId: post.id,
        task: "editorial_review",
        prompt,
        model:
          process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
        provider: providerName,
        tokens: result.usage.tokensIn + result.usage.tokensOut,
        moderated: true,
      });
      return NextResponse.json(
        { error: "Generated feedback failed moderation" },
        { status: 422 },
      );
    }

    const budget = await enforceMonthlyBudget({
      userId: session.user.id,
      additionalCost: result.usage.costUsd,
    });
    await recordAIUsage({
      userId: session.user.id,
      postId: post.id,
      task: "editorial_review",
      model:
        process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      usage: result.usage,
    });
    await recordAuditLog({
      userId: session.user.id,
      postId: post.id,
      task: "editorial_review",
      prompt,
      model:
        process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini",
      provider: providerName,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
      moderated: false,
    });

    const response = NextResponse.json(
      {
        review,
        advisory: true,
        usage: result.usage,
      },
      { status: 200 },
    );
    response.headers.set(
      "X-AI-Usage-Tokens-In",
      String(result.usage.tokensIn ?? 0),
    );
    response.headers.set(
      "X-AI-Usage-Tokens-Out",
      String(result.usage.tokensOut ?? 0),
    );
    response.headers.set(
      "X-AI-Cost-USD",
      result.usage.costUsd ? result.usage.costUsd.toFixed(6) : "0",
    );
    response.headers.set("X-AI-Budget-Limit", String(budget.limit ?? 0));
    response.headers.set(
      "X-AI-Budget-Remaining",
      Number.isFinite(budget.remaining)
        ? String(Math.max(0, Math.round(budget.remaining)))
        : "-1",
    );
    if (!budget.allowed) {
      response.headers.set("X-AI-Budget-Status", "exceeded");
    }
    Object.entries(buildRateLimitHeaders(rateLimit, 30)).forEach(
      ([key, value]) => response.headers.set(key, value),
    );
    return response;
  } catch (error) {
    console.error("Editorial AI review failed", error);
    return NextResponse.json(
      { error: "AI editorial review failed" },
      { status: 502 },
    );
  }
}

function buildRateLimitHeaders(
  result: { remaining: number; reset: number },
  limit: number,
) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, Math.floor(result.remaining))),
    "X-RateLimit-Reset": String(result.reset),
  };
}
