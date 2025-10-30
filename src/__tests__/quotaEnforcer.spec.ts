import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const planQuota = { findFirst: vi.fn() };
  const aIUsageLog = { aggregate: vi.fn() };
  return { prisma: { planQuota, aIUsageLog }, isDatabaseEnabled: true };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("applyQuotaUsage", () => {
  it("throws when usage exceeds limit", async () => {
    const { applyQuotaUsage } = await import("@/lib/ai/quota");
    const { prisma } = (await import("@/lib/prisma")) as {
      prisma: {
        planQuota: { findFirst: ReturnType<typeof vi.fn> };
        aIUsageLog: { aggregate: ReturnType<typeof vi.fn> };
      };
    };
    prisma.planQuota.findFirst.mockResolvedValue({ aiTokensMonthly: 100 });
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 95 } });

    await expect(applyQuotaUsage("tenant_1", 10)).rejects.toMatchObject({ status: 402 });
  });

  it("returns status and warnings when crossing threshold", async () => {
    const { applyQuotaUsage } = await import("@/lib/ai/quota");
    const { prisma } = (await import("@/lib/prisma")) as {
      prisma: {
        planQuota: { findFirst: ReturnType<typeof vi.fn> };
        aIUsageLog: { aggregate: ReturnType<typeof vi.fn> };
      };
    };
    prisma.planQuota.findFirst.mockResolvedValue({ aiTokensMonthly: 1000 });
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 750 } });

    const result = await applyQuotaUsage("tenant_1", 200);
    expect(result.status.used).toBe(950);
    expect(result.status.warnings[0]?.level).toBe("warning");
  });
});
