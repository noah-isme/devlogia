import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { removeObject } from "@/lib/storage";

const updateMediaSchema = z.object({
  alt: z.string().trim().max(256).nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "media:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateMediaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const media = await prisma.media.update({ where: { id }, data: { alt: parsed.data.alt } });
  await recordAuditLog({ userId: session.user.id, action: "media:update", targetId: id, meta: { alt: media.alt } });

  return NextResponse.json({ media });
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
  if (!can(session.user, "media:delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await removeObject(media.path);
  await prisma.media.delete({ where: { id } });
  await recordAuditLog({ userId: session.user.id, action: "media:delete", targetId: id, meta: { path: media.path } });

  return NextResponse.json({ success: true });
}
