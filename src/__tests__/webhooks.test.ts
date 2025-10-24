import crypto from "crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { triggerOutbound } from "@/lib/webhooks";
import { resetRateLimits } from "@/lib/ratelimit";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { revalidatePath } = await import("next/cache");
const { POST } = await import("@/app/api/webhooks/revalidate/route");
const originalFetch = global.fetch;

describe("webhooks", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.restoreAllMocks();
    vi.mocked(revalidatePath).mockClear();
    global.fetch = originalFetch;
  });

  it("triggers outbound webhooks for each configured URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.WEBHOOKS_OUTBOUND_URLS = '["https://example.com/one","https://example.com/two"]';

    await triggerOutbound("post.published", { id: "post-1" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/one", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-Devlogia-Event": "post.published" }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/two", expect.any(Object));
  });

  it("validates inbound webhook signatures", async () => {
    process.env.WEBHOOKS_SIGNING_SECRET = "test-secret";
    const body = JSON.stringify({ slug: "hello-world" });
    const sig = crypto.createHmac("sha256", "test-secret").update(body).digest("hex");

    const request = new Request("http://localhost/api/webhooks/revalidate", {
      method: "POST",
      headers: {
        "x-devlogia-signature": sig,
        "x-forwarded-for": "127.0.0.1",
      },
      body,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(revalidatePath).toHaveBeenCalledWith("/blog/hello-world");
  });

  it("rejects invalid signatures", async () => {
    process.env.WEBHOOKS_SIGNING_SECRET = "another-secret";
    const body = JSON.stringify({ slug: "hello-world" });
    const request = new Request("http://localhost/api/webhooks/revalidate", {
      method: "POST",
      headers: {
        "x-devlogia-signature": "invalid",
        "x-forwarded-for": "127.0.0.2",
      },
      body,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("applies rate limiting to inbound webhooks", async () => {
    process.env.WEBHOOKS_SIGNING_SECRET = "rate-secret";
    const body = JSON.stringify({ slug: "limited" });
    const sig = crypto.createHmac("sha256", "rate-secret").update(body).digest("hex");

    const makeRequest = () =>
      new Request("http://localhost/api/webhooks/revalidate", {
        method: "POST",
        headers: {
          "x-devlogia-signature": sig,
          "x-forwarded-for": "10.0.0.1",
        },
        body,
      });

    for (let index = 0; index < 60; index += 1) {
      const response = await POST(makeRequest());
      expect(response.status).toBe(200);
    }

    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
  });
});
