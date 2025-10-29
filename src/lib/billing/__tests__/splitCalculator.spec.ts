import { describe, expect, it } from "vitest";

import { calculateRevenueSplit } from "@/lib/billing/orders";

describe("calculateRevenueSplit", () => {
  it("distributes cents without precision loss", () => {
    const split = calculateRevenueSplit(12345, 0.15);
    expect(split.platformAmountCents).toBe(1852);
    expect(split.authorAmountCents + split.platformAmountCents + split.tenantAmountCents).toBe(12345);
  });

  it("caps percentages at 100%", () => {
    const split = calculateRevenueSplit(10000, 0.8, 0.4);
    expect(split.platformPct).toBeCloseTo(0.8);
    expect(split.tenantPct).toBeCloseTo(0.2);
    expect(split.authorPct).toBeCloseTo(0);
    expect(split.platformAmountCents + split.tenantAmountCents + split.authorAmountCents).toBe(10000);
  });
});
