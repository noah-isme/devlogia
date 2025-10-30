import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createSubmission, listSubmissions } from "@/lib/devportal/submission-store";

const createSchema = z.object({
  repoUrl: z.string().url(),
  version: z.string().min(1),
  manifest: z.string().min(1),
  scopes: z.array(z.string()).default([]),
});

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const isInternal = scope === "all" && session?.user && session.user.role !== "viewer";
  const ownerId = isInternal ? undefined : session?.user?.id ?? "guest";
  const submissions = listSubmissions(ownerId);
  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission payload" }, { status: 400 });
  }

  const ownerId = session?.user?.id ?? "guest";
  const submission = createSubmission(ownerId, parsed.data);

  return NextResponse.json({ submission }, { status: 201 });
}
