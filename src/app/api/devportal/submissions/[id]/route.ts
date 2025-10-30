import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getSubmission, updateSubmission } from "@/lib/devportal/submission-store";

const updateSchema = z.object({
  repoUrl: z.string().url().optional(),
  version: z.string().min(1).optional(),
  manifest: z.string().min(1).optional(),
  scopes: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const submission = getSubmission(id);

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const ownerId = session?.user?.id ?? "guest";
  if (submission.ownerId !== ownerId) {
    return NextResponse.json({ error: "You cannot modify this submission" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const updated = updateSubmission(id, parsed.data);
  return NextResponse.json({ submission: updated });
}
