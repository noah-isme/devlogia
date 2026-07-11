import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createDraftPreviewToken } from "@/lib/cms/preview-token";
import { can } from "@/lib/rbac";

type RouteContext = {
  readonly params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!can(session.user, "post:update", post)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preview = createDraftPreviewToken(post.id);
  return NextResponse.json({
    previewUrl: `/preview/posts/${post.id}?token=${encodeURIComponent(preview.token)}`,
    expiresAt: preview.expiresAt,
  });
}
