import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { restorePageRevision } from "@/lib/cms/revisions";
import { can } from "@/lib/rbac";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const { id, revisionId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "page:update")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const restored = await restorePageRevision({ prisma, pageId: id, revisionId, userId: session.user.id });
  if (!restored) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const page = await prisma.page.findUnique({ where: { id } });
  return NextResponse.json({ page });
}
