import { NextRequest, NextResponse } from "next/server";

import type { PrismaClient } from "@prisma/client";

import { auth } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { pageSchema } from "@/lib/validations/page";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function ensureUniqueSlug(prismaClient: PrismaClient, slug: string, excludeId: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prismaClient.page.findFirst({
      where: {
        slug: candidate,
        NOT: { id: excludeId },
      },
    });

    if (!existing) {
      return candidate;
    }
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "page:update")) {
    return forbidden();
  }

  const existing = await prisma.page.findUnique({ where: { id } });
  if (!existing) {
    return notFound();
  }

  const json = await request.json().catch(() => ({}));
  const parsed = pageSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const slug = await ensureUniqueSlug(prisma, slugify(payload.slug), id);

  const page = await prisma.page.update({
    where: { id },
    data: {
      title: payload.title,
      slug,
      contentMdx: payload.contentMdx,
      published: payload.published,
    },
  });

  await recordAuditLog({
    userId: session.user.id,
    action: "page:update",
    targetId: page.id,
    meta: { published: page.published },
  });

  if (!existing.published && page.published) {
    await recordAuditLog({
      userId: session.user.id,
      action: "page:publish",
      targetId: page.id,
      meta: { slug: page.slug },
    });
  }

  if (existing.published && !page.published) {
    await recordAuditLog({
      userId: session.user.id,
      action: "page:unpublish",
      targetId: page.id,
      meta: { slug: page.slug },
    });
  }

  return NextResponse.json({ page });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (!can(session.user, "page:delete")) {
    return forbidden();
  }
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) {
    return notFound();
  }
  await prisma.page.delete({ where: { id } });
  await recordAuditLog({
    userId: session.user.id,
    action: "page:delete",
    targetId: id,
    meta: { slug: page.slug },
  });
  return NextResponse.json({ success: true });
}
