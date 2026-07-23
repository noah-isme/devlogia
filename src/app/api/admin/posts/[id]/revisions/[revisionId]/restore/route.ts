import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { restorePostRevision } from "@/lib/cms/revisions";
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

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(session.user, "post:update", post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const restored = await restorePostRevision({ prisma, postId: id, revisionId, userId: session.user.id });
  if (!restored) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const updated = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });

  const revisions = await prisma.postRevision.findMany({
    where: { postId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, reason: true, title: true, summary: true, contentMdx: true, status: true, createdAt: true },
  });

  return NextResponse.json({ post: updated, revisions });
}
