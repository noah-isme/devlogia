import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "superadmin")) {
    return new NextResponse("Unauthorized admin access required", { status: 401 });
  }

  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;

  if (!isDatabaseEnabled) {
    return new NextResponse("Database connection unavailable", { status: 503 });
  }

  try {
    const [posts, pages, comments, media, tags] = await Promise.all([
      prisma.post.findMany({
        include: {
          tags: { include: { tag: true } },
          revisions: { orderBy: { createdAt: "desc" }, take: 10 },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.page.findMany({
        include: { revisions: { orderBy: { createdAt: "desc" }, take: 10 } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.comment.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.media.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);

    const backupPayload = {
      exportVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      system: "Devlogia CMS",
      totals: {
        posts: posts.length,
        pages: pages.length,
        comments: comments.length,
        media: media.length,
        tags: tags.length,
      },
      data: {
        posts,
        pages,
        comments,
        media,
        tags,
      },
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const jsonString = JSON.stringify(backupPayload, null, 2);

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="devlogia-backup-${dateStr}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate system backup export:", error);
    return new NextResponse("Backup generation failed", { status: 500 });
  }
}
