import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { buildMonthlyViewSeries, computePostStatusSummary, computeViewTotal, mapTopTags } from "@/lib/analytics";
import { can } from "@/lib/rbac";

export async function GET() {
  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;
  if (!isDatabaseEnabled) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session.user, "analytics:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [postStatusCounts, postsForViews, totalPages, publishedPages, totalUsers, activeUsers, totalTags, topTagCounts] =
    await Promise.all([
      prisma.post.groupBy({
        by: ["status"],
        _count: { status: true },
        orderBy: { status: "asc" },
      }),
      prisma.post.findMany({ select: { id: true, createdAt: true, publishedAt: true, status: true } }),
      prisma.page.count(),
      prisma.page.count({ where: { published: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.tag.count(),
      prisma.postTag.groupBy({
        by: ["tagId"],
        _count: { tagId: true },
        orderBy: { _count: { tagId: "desc" } },
        take: 5,
      }),
    ]);

  const tagRecords = topTagCounts.length
    ? await prisma.tag.findMany({ where: { id: { in: topTagCounts.map((entry) => entry.tagId) } }, select: { id: true, name: true } })
    : [];

  const postSummary = computePostStatusSummary(postStatusCounts);
  const viewTotal = computeViewTotal(postsForViews);
  const trafficPoints = buildMonthlyViewSeries(postsForViews);

  return NextResponse.json({
    posts: {
      ...postSummary,
      views: viewTotal,
    },
    pages: {
      total: totalPages,
      published: publishedPages,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: Math.max(totalUsers - activeUsers, 0),
    },
    tags: {
      total: totalTags,
      top: mapTopTags(tagRecords, topTagCounts),
    },
    traffic: {
      timeframe: `${trafficPoints.length} months`,
      points: trafficPoints,
    },
    generatedAt: new Date().toISOString(),
  });
}
