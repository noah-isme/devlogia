import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getSubmission, updateSubmission } from "@/lib/devportal/submission-store";
import type { Role } from "@/lib/rbac";

const reviewSchema = z.object({
  status: z.enum(["draft", "in_review", "approved", "rejected"]),
  badges: z.array(z.string()).default([]),
  notes: z.string().optional(),
  checklist: z.array(z.string()).optional(),
});

const ALLOWED_ROLES = new Set<Role>(["superadmin", "admin", "tenantAdmin"]);

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const role = session?.user?.role ?? "viewer";
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submission = getSubmission(id);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
  }

  const checklist = parsed.data.checklist ?? [];
  const updated = updateSubmission(id, {
    status: parsed.data.status,
    badges: parsed.data.badges,
    notes: parsed.data.notes,
    reviewChecklist: checklist,
    reviewerId: session?.user?.id,
  });

  return NextResponse.json({ submission: updated });
}
