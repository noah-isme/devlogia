import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    planQuota: {
      findFirst,
      update,
      create,
    },
  },
}));

vi.mock("@/lib/billing/plans", () => ({
  calculatePlanLimits: () => ({
    quotas: {
      ai: { monthlyTokens: 1000 },
      storage: { maxMegabytes: 2048 },
    },
  }),
}));

const { syncTenantPlanQuota } = await import("@/lib/billing/quota");

describe("syncTenantPlanQuota", () => {
  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
    create.mockReset();
  });

  it("creates a quota record when none exists", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "quota-1", plan: "pro" });

    const record = await syncTenantPlanQuota("tenant-1", "pro");

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-1", plan: "pro", aiTokensMonthly: 1000, storageMB: 2048 }),
      }),
    );
    expect(record).toEqual({ id: "quota-1", plan: "pro" });
  });

  it("closes existing quota when values change", async () => {
    const existing = { id: "quota-existing", plan: "free", aiTokensMonthly: 500, storageMB: 1024, seats: 5 };
    findFirst.mockResolvedValue(existing);
    update.mockResolvedValue({});
    create.mockResolvedValue({ id: "quota-new", plan: "pro" });

    await syncTenantPlanQuota("tenant-1", "pro", { aiTokensMonthly: 2000 });

    expect(update).toHaveBeenCalledWith({ where: { id: "quota-existing" }, data: expect.objectContaining({ effectiveTo: expect.any(Date) }) });
    expect(create).toHaveBeenCalled();
  });

  it("returns existing quota when unchanged", async () => {
    const existing = { id: "quota-existing", plan: "pro", aiTokensMonthly: 1000, storageMB: 2048, seats: 25 };
    findFirst.mockResolvedValue(existing);

    const result = await syncTenantPlanQuota("tenant-1", "pro");

    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
