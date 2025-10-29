import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { queryFederationRecommendations } from "@/lib/federation/query";
import { can } from "@/lib/rbac";
import { tenantConfig } from "@/lib/tenant";

const schema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  tags: z.array(z.string()).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !can(session.user, "federation:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!tenantConfig.federation.indexUrl) {
    return NextResponse.json({ error: "Federation index unavailable" }, { status: 503 });
  }

  const data = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", detail: parsed.error.flatten() }, { status: 400 });
  }

  const result = await queryFederationRecommendations({
    query: parsed.data.query,
    limit: parsed.data.limit,
    tags: parsed.data.tags,
    tenantSlug: process.env.TENANT_SLUG ?? "default",
  });

  return NextResponse.json(result, {
    headers: {
      "X-Federation-Latency": result.latencyMs.toFixed(0),
      "X-Federation-Fallback": result.fallback ? "1" : "0",
    },
  });
}
