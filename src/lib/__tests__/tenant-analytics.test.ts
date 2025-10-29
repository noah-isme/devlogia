import { describe, expect, it, vi } from "vitest";

import { computeTenantAnalytics } from "@/lib/analytics/tenant";

const prisma = {
  tenant: {
    findUnique: vi.fn(async () => ({ id: "tenant-1", plan: "pro" })),
  },
  federationIndex: {
    findMany: vi.fn(async () => [
      { postId: "post-1", score: 1.5 },
      { postId: "post-2", score: 0.8 },
    ]),
  },
  aIUsage: {
    groupBy: vi.fn(async () => [
      { postId: "post-1", _sum: { usd: 4.25 } },
      { postId: "post-3", _sum: { usd: 10 } },
    ]),
  },
} as unknown as Parameters<typeof computeTenantAnalytics>[0];

describe("computeTenantAnalytics", () => {
  it("aggregates federation, usage, and revenue", async () => {
    const row = await computeTenantAnalytics(prisma, "tenant-1");
    expect(row.tenantId).toBe("tenant-1");
    expect(row.visits).toBeGreaterThan(0);
    expect(row.aiUsage).toBeCloseTo(4.25, 2);
    expect(row.revenue).toBeGreaterThan(0);
    expect(row.federationShare).toBeCloseTo(2.3, 1);
  });

  it("throws when tenant is missing", async () => {
    const failingPrisma = {
      ...prisma,
      tenant: {
        findUnique: vi.fn(async () => null),
      },
    } as unknown as Parameters<typeof computeTenantAnalytics>[0];

    await expect(computeTenantAnalytics(failingPrisma, "missing")).rejects.toThrow(/not found/);
  });
});
