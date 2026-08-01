import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "page:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, cursor } = parsed.data;

  const page = await prisma.page.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const where = { pageId: id };
  if (cursor) {
    where["createdAt"] = { lt: new Date(cursor) };
  }

  const revisions = await prisma.pageRevision.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      reason: true,
      createdAt: true,
      userId: true,
    },
  });

  let nextCursor: string | undefined;
  if (revisions.length > limit) {
    const next = revisions.pop();
    nextCursor = next!.createdAt.toISOString();
  }

  return NextResponse.json({
    page: { id: page.id, title: page.title, slug: page.slug },
    revisions,
    nextCursor,
  });
}