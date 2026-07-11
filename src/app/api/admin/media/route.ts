import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isMediaUsedByContent } from "@/lib/cms/media";
import { can } from "@/lib/rbac";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!can(session.user, "media:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { prisma } = prismaModule;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const media = await prisma.media.findMany({
    where: query
      ? { OR: [{ alt: { contains: query } }, { path: { contains: query } }, { publicUrl: { contains: query } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
  });
  const [posts, pages] = await Promise.all([
    prisma.post.findMany({ select: { coverUrl: true, contentMdx: true } }),
    prisma.page.findMany({ select: { contentMdx: true } }),
  ]);
  const postCoverUrls = posts.map((post) => post.coverUrl).filter((coverUrl): coverUrl is string => Boolean(coverUrl));
  const postBodies = posts.map((post) => post.contentMdx);
  const pageBodies = pages.map((page) => page.contentMdx);

  return NextResponse.json({
    media: media.map((asset) => ({
      ...asset,
      unused: !isMediaUsedByContent(asset, { postCoverUrls, postBodies, pageBodies }),
    })),
  });
}
