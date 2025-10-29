import { describe, expect, it } from "vitest";

import { createOrderIdempotencyKey } from "@/lib/billing/orders";

describe("createOrderIdempotencyKey", () => {
  it("hashes payment intent ids for stable keys", () => {
    const key = createOrderIdempotencyKey("pi_123");
    const same = createOrderIdempotencyKey("pi_123");
    expect(key).toBe(same);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns null when payment intent is missing", () => {
    expect(createOrderIdempotencyKey(null)).toBeNull();
    expect(createOrderIdempotencyKey(undefined)).toBeNull();
  });
});
