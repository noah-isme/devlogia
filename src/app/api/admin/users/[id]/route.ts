import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";

const updateSchema = z.object({ role: z.enum(["owner", "editor", "writer"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "user:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { role } = parsed.data;
  if (target.role === role) {
    return NextResponse.json({ user: target });
  }

  if (target.role === "owner" && role !== "owner") {
    const owners = await prisma.user.count({ where: { role: "owner" } });
    if (owners <= 1) {
      return NextResponse.json({ error: "Cannot remove the last owner." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  await recordAuditLog({
    userId: session.user.id,
    action: "user:update",
    targetId: updated.id,
    meta: { role: updated.role },
  });

  return NextResponse.json({ user: updated });
}
