import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { resolveAIProvider } from "@/lib/ai/provider";
import { can } from "@/lib/rbac";
import { checkRateLimit, parseRateLimit } from "@/lib/ratelimit";

const outlineSchema = z.object({ topic: z.string().min(3) });
const metaSchema = z.object({ title: z.string().min(1), content: z.string().min(10) });
const tagsSchema = z.object({ content: z.string().min(10), limit: z.number().int().positive().max(20).optional() });
const rephraseSchema = z.object({ content: z.string().min(5) });

type Endpoint = "outline" | "meta" | "tags" | "rephrase";

const disabledResponse = NextResponse.json({ error: "AI assistant disabled" }, { status: 503 });

export async function POST(request: Request, { params }: { params: Promise<{ endpoint: string }> }) {
  const { endpoint } = await params;

  if (!isEndpoint(endpoint)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const providerName = (process.env.AI_PROVIDER || "none").toLowerCase();
  if (providerName === "none") {
    return disabledResponse;
  }

  const limit = parseRateLimit(process.env.AI_RATE_LIMIT_PER_MIN, 30);
  const result = checkRateLimit(`ai:${session.user.id}`, limit, 60_000);
  if (!result.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const payload = await request.json().catch(() => ({}));
  const provider = resolveAIProvider();

  try {
    switch (endpoint) {
      case "outline": {
        const parsed = outlineSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const data = await provider.suggestOutline(parsed.data.topic);
        return NextResponse.json({ data });
      }
      case "meta": {
        const parsed = metaSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const data = await provider.suggestMeta(parsed.data.title, parsed.data.content);
        return NextResponse.json({ data });
      }
      case "tags": {
        const parsed = tagsSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const data = await provider.suggestTags(parsed.data.content, parsed.data.limit);
        return NextResponse.json({ data });
      }
      case "rephrase": {
        const parsed = rephraseSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }
        const data = await provider.rephrase(parsed.data.content);
        return NextResponse.json({ data });
      }
      default:
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("AI provider failed", error);
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}

function isEndpoint(value: string): value is Endpoint {
  return value === "outline" || value === "meta" || value === "tags" || value === "rephrase";
}
