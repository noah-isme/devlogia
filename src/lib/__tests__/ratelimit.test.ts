import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";

let ratelimitModule: typeof import("@/lib/ratelimit") | null = null;

async function loadModule() {
  if (!ratelimitModule) {
    ratelimitModule = await import("@/lib/ratelimit");
  }
  return ratelimitModule;
}

beforeEach(() => {
  jestReset();
});

afterEach(async () => {
  const mod = await loadModule();
  mod.resetRateLimits();
});

function jestReset() {
  ratelimitModule = null;
  vi.resetModules();
  delete process.env.RATE_LIMIT_ALLOWLIST;
  delete process.env.RATE_LIMIT_REDIS_URL;
}

describe("ratelimit", () => {
  test("allows within limit", async () => {
    const mod = await loadModule();
    const result = await mod.checkRateLimit("test", 3, 1_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  test("blocks after exceeding limit", async () => {
    const mod = await loadModule();
    await mod.checkRateLimit("limit", 1, 1_000);
    const result = await mod.checkRateLimit("limit", 1, 1_000);
    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("respects allowlist", async () => {
    process.env.RATE_LIMIT_ALLOWLIST = "127.0.0.1";
    const mod = await loadModule();
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    const key = mod.resolveRateLimitKey(request, "fallback");
    const result = await mod.checkRateLimit(key, 1, 1_000, { bypass: mod.isRateLimitBypassed(request) });
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });
});
