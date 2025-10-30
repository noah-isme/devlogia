import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("logAIExtensionUsage", () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "mysql://stub:stub@127.0.0.1:3306/devlogia_test";

  let logAIExtensionUsage: (typeof import("@/lib/ai/extensions"))["logAIExtensionUsage"];
  let prisma: typeof import("@/lib/prisma") extends { prisma: infer T } ? T : never;
  let prismaModule: typeof import("@/lib/prisma");
  let quotaModule: typeof import("@/lib/ai/quota");
  let loggerModule: typeof import("@/lib/logger");

  let findExtensionSpy: ReturnType<typeof vi.spyOn>;
  let createUsageSpy: ReturnType<typeof vi.spyOn>;
  let applyQuotaUsageSpy: ReturnType<typeof vi.spyOn>;
  let getTenantQuotaStatusSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
  let originalExtensionDelegate: unknown;
  let originalUsageDelegate: unknown;

  beforeAll(async () => {
    prismaModule = await import("@/lib/prisma");
    quotaModule = await import("@/lib/ai/quota");
    loggerModule = await import("@/lib/logger");
    const extensionsModule = await import("@/lib/ai/extensions");

    prisma = prismaModule.prisma;
    logAIExtensionUsage = extensionsModule.logAIExtensionUsage;

    originalExtensionDelegate = prisma.aIExtension;
    originalUsageDelegate = prisma.aIUsageLog;

    const extensionDelegate = { findFirst: vi.fn() };
    const usageDelegate = { create: vi.fn() };

    Object.defineProperty(prisma, "aIExtension", {
      configurable: true,
      writable: true,
      value: extensionDelegate,
    });
    Object.defineProperty(prisma, "aIUsageLog", {
      configurable: true,
      writable: true,
      value: usageDelegate,
    });

    findExtensionSpy = vi.spyOn(extensionDelegate, "findFirst");
    createUsageSpy = vi.spyOn(usageDelegate, "create");
    applyQuotaUsageSpy = vi.spyOn(quotaModule, "applyQuotaUsage");
    getTenantQuotaStatusSpy = vi.spyOn(quotaModule, "getTenantQuotaStatus");
    loggerWarnSpy = vi.spyOn(loggerModule.logger, "warn");
  });

  beforeEach(() => {
    findExtensionSpy.mockReset();
    createUsageSpy.mockReset();
    applyQuotaUsageSpy.mockReset();
    getTenantQuotaStatusSpy.mockReset();
    loggerWarnSpy.mockReset();
  });

  afterAll(() => {
    findExtensionSpy.mockRestore();
    createUsageSpy.mockRestore();
    applyQuotaUsageSpy.mockRestore();
    getTenantQuotaStatusSpy.mockRestore();
    loggerWarnSpy.mockRestore();

    Object.defineProperty(prisma, "aIExtension", {
      configurable: true,
      writable: true,
      value: originalExtensionDelegate,
    });
    Object.defineProperty(prisma, "aIUsageLog", {
      configurable: true,
      writable: true,
      value: originalUsageDelegate,
    });
  });

  it("throws when extension is not active", async () => {
    findExtensionSpy.mockResolvedValue(null);

    await expect(
      logAIExtensionUsage({
        tenantId: "ctenant1234567890",
        userId: "cuser1234567890",
        extensionId: "cext1234567890",
        tokensUsed: 10,
        costCents: 25,
        promptSummary: "testing",
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(applyQuotaUsageSpy).not.toHaveBeenCalled();
    expect(createUsageSpy).not.toHaveBeenCalled();
  });

  it("creates usage log when extension is active", async () => {
    findExtensionSpy.mockResolvedValue({ id: "cext_123456", tenantId: "ctenant_123456" });
    createUsageSpy.mockResolvedValue({ id: "log_1" });
    applyQuotaUsageSpy.mockResolvedValue({
      status: {
        limit: 1000,
        used: 142,
        remaining: 858,
        utilization: 0.142,
        warnings: [],
      },
      triggered: [],
    });

    const result = await logAIExtensionUsage({
      tenantId: "ctenant_123456",
      userId: "cuser_123456",
      extensionId: "cext_123456",
      tokensUsed: 42,
      costCents: 100,
      promptSummary: " Example summary that will be trimmed ",
      moderationStatus: "safe",
    });

    expect(createUsageSpy).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "ctenant_123456",
        userId: "cuser_123456",
        extensionId: "cext_123456",
        tokensUsed: 42,
        costCents: 100,
        promptSummary: " Example summary that will be trimmed ".slice(0, 256),
        moderationStatus: "safe",
      }),
      select: { id: true },
    });
    expect(result.logId).toBe("log_1");
    expect(result.quota.status.limit).toBe(1000);
  });

  it("skips logging when database is disabled", async () => {
    const databaseFlagSpy = vi.spyOn(prismaModule, "isDatabaseEnabled", "get").mockReturnValue(false);
    getTenantQuotaStatusSpy.mockResolvedValue({
      limit: 1000,
      used: 100,
      remaining: 900,
      utilization: 0.1,
      warnings: [],
    });

    const result = await logAIExtensionUsage({
      tenantId: "ctenant_skip",
      userId: "cuser_skip",
      extensionId: "cext_skip",
      tokensUsed: 10,
      costCents: 0,
    });

    expect(result.logId).toBeNull();
    expect(result.quota.status.used).toBe(100);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      { tenantId: "ctenant_skip" },
      "AI usage log skipped because database is disabled",
    );
    expect(findExtensionSpy).not.toHaveBeenCalled();
    expect(applyQuotaUsageSpy).not.toHaveBeenCalled();

    databaseFlagSpy.mockRestore();
  });
});
