import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { can, resolveHighestRole } from "@/lib/rbac";
import { toRoleName } from "@/lib/roles";

const updateSchema = z.object({ role: z.enum(["superadmin", "admin", "editor", "writer"] as const) });

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

  const target = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const currentRole = resolveHighestRole(target.roles.map((entry) => entry.role.name.toLowerCase()));
  const { role } = parsed.data;

  if (currentRole === role) {
    return NextResponse.json({
      user: {
        id: target.id,
        email: target.email,
        createdAt: target.createdAt.toISOString(),
        isActive: target.isActive,
        role: currentRole,
      },
    });
  }

  if (currentRole === "superadmin" && role !== "superadmin") {
    const remaining = await prisma.user.count({
      where: {
        roles: {
          some: {
            role: { name: toRoleName("superadmin") },
          },
        },
        id: { not: target.id },
      },
    });
    if (remaining === 0) {
      return NextResponse.json({ error: "Cannot remove the last superadmin." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      roles: {
        deleteMany: {},
        create: { role: { connect: { name: toRoleName(role) } } },
      },
    },
    select: { id: true, email: true, isActive: true, createdAt: true, roles: { include: { role: true } } },
  });

  const resolvedRole = resolveHighestRole(updated.roles.map((entry) => entry.role.name.toLowerCase()));

  await recordAuditLog({
    userId: session.user.id,
    action: "user:update",
    targetId: updated.id,
    meta: { role: resolvedRole },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      createdAt: updated.createdAt.toISOString(),
      isActive: updated.isActive,
      role: resolvedRole,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "user:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentRole = resolveHighestRole(target.roles.map((entry) => entry.role.name.toLowerCase()));
  if (currentRole === "superadmin") {
    const remaining = await prisma.user.count({
      where: {
        roles: {
          some: {
            role: { name: toRoleName("superadmin") },
          },
        },
        id: { not: target.id },
      },
    });
    if (remaining === 0) {
      return NextResponse.json({ error: "Cannot remove the last superadmin." }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });

  await recordAuditLog({
    userId: session.user.id,
    action: "user:delete",
    targetId: id,
    meta: { email: target.email },
  });

  return NextResponse.json({ success: true });
}
