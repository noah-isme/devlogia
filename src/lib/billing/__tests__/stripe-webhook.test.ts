import type Stripe from "stripe";
import { describe, expect, test, vi, beforeEach } from "vitest";

const updateMock = vi.fn(async () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      update: updateMock,
    },
  },
}));

const { handleStripeEvent } = await import("@/lib/billing/stripe");

describe("handleStripeEvent", () => {
  beforeEach(() => {
    updateMock.mockClear();
  });

  test("updates tenant plan when checkout session completed", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { tenantId: "tenant-1", plan: "pro" },
          subscription: "sub_123",
          line_items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeEvent(event);

    expect(result).toEqual({ status: "updated", plan: "pro" });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-1" },
        data: expect.objectContaining({ plan: "pro" }),
      }),
    );
  });

  test("ignores events without tenant metadata", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    const result = await handleStripeEvent(event);
    expect(result).toEqual({ status: "ignored" });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
