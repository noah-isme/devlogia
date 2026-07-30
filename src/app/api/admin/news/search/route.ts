import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { NewsResearchError, searchCurrentNews, signResearchSources } from "@/lib/news";

const querySchema = z.object({ query: z.string().trim().min(3).max(200), limit: z.number().int().min(1).max(10).optional() });
const ADMIN_ROLES = new Set(["admin", "superadmin"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(session.user.role)) return NextResponse.json({ error: "Only administrators can research current news" }, { status: 403 });

  const parsed = querySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const sources = await searchCurrentNews(parsed.data.query, parsed.data.limit);
    return NextResponse.json({ sources, researchToken: signResearchSources(sources) });
  } catch (error) {
    if (error instanceof NewsResearchError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("News research failed", error);
    return NextResponse.json({ error: "News research failed" }, { status: 502 });
  }
}
