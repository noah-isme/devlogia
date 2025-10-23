import { NextResponse } from "next/server";

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

async function ensureUniqueSlug(slug: string, excludeId?: string) {
  for (let counter = 0; ; counter += 1) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.page.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (!existing) {
      return candidate;
    }
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }

  const pages = await prisma.page.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ pages });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return unauthorized();
  }
  if (session.user.role !== "admin") {
    return forbidden();
  }

  const body = await request.json().catch(() => ({}));
  const parsed = pageSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const title = payload?.title ?? "Untitled page";
  const slug = await ensureUniqueSlug(
    payload?.slug ? slugify(payload.slug) : slugify(title) || `page-${Date.now()}`,
  );

  const page = await prisma.page.create({
    data: {
      title,
      slug,
      contentMdx:
        payload?.contentMdx ?? `# ${title}\n\nWelcome to your new page. Update this content in the admin dashboard.`,
      published: payload?.published ?? false,
    },
  });

  return NextResponse.json({ page }, { status: 201 });
}
