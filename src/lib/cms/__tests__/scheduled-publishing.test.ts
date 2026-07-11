import { describe, expect, test, vi } from "vitest";

import { publishDueScheduledPosts } from "@/lib/cms/scheduled-publishing";

describe("publishDueScheduledPosts", () => {
  test("publishes scheduled posts whose publish time has arrived", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const findMany = vi.fn(async () => [
      { id: "post_1", slug: "ready", status: "SCHEDULED" as const, publishedAt: new Date("2026-07-11T11:59:00Z") },
    ]);
    const update = vi.fn(async () => ({ id: "post_1", slug: "ready", status: "PUBLISHED" as const, publishedAt: now }));
    const auditLogCreate = vi.fn(async () => ({ id: "audit_1" }));

    const result = await publishDueScheduledPosts({
      now,
      prisma: {
        post: { findMany, update },
        auditLog: { create: auditLogCreate },
      },
      triggerOutbound: vi.fn(async () => undefined),
      notifySearchEngines: vi.fn(async () => undefined),
    });

    expect(result).toEqual({ published: 1 });
    expect(findMany).toHaveBeenCalledWith({
      where: { status: "SCHEDULED", publishedAt: { lte: now } },
      orderBy: { publishedAt: "asc" },
      take: 50,
      select: { id: true, slug: true, status: true, publishedAt: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { status: "PUBLISHED", publishedAt: now },
      select: { id: true, slug: true, status: true, publishedAt: true },
    });
    expect(auditLogCreate).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: "post:publish",
        targetId: "post_1",
        meta: { slug: "ready", source: "scheduled-worker" },
      },
    });
  });
});
