import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { can, resolveHighestRole } from "@/lib/rbac";
import { toRoleName } from "@/lib/roles";

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["tenantAdmin", "admin", "editor", "writer", "viewer"] as const),
});

export async function GET() {
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "user:list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, isActive: true, createdAt: true, roles: { include: { role: true } } },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      role: resolveHighestRole(user.roles.map((entry) => entry.role.name.toLowerCase())),
    })),
  });
}

export async function POST(request: Request) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "user:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, role } = parsed.data;
  const lowerEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email: lowerEmail,
      passwordHash,
      isActive: true,
      roles: {
        create: {
          role: { connect: { name: toRoleName(role) } },
        },
      },
    },
    select: { id: true, email: true, isActive: true, createdAt: true, roles: { include: { role: true } } },
  });

  return NextResponse.json({
    user: {
      id: created.id,
      email: created.email,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      role: resolveHighestRole(created.roles.map((entry) => entry.role.name.toLowerCase())),
    },
  });
}
