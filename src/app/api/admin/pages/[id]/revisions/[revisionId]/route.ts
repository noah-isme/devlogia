import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string; revisionId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "page:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, revisionId } = await params;

  const page = await prisma.page.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, contentMdx: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const revision = await prisma.pageRevision.findFirst({
    where: { id: revisionId, pageId: id },
    select: {
      id: true,
      title: true,
      slug: true,
      contentMdx: true,
      status: true,
      publishedAt: true,
      reason: true,
      createdAt: true,
      userId: true,
    },
  });

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  return NextResponse.json({
    page: { id: page.id, title: page.title, slug: page.slug, contentMdx: page.contentMdx },
    revision,
  });
}