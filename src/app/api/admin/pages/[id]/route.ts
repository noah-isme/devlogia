import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

async function ensureUniqueSlug(slug: string, excludeId: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.page.findFirst({
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
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (session.user.role !== "admin") {
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
  const slug = await ensureUniqueSlug(slugify(payload.slug), id);

  const page = await prisma.page.update({
    where: { id },
    data: {
      title: payload.title,
      slug,
      contentMdx: payload.contentMdx,
      published: payload.published,
    },
  });

  return NextResponse.json({ page });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (session.user.role !== "admin") {
    return forbidden();
  }
  await prisma.page.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
