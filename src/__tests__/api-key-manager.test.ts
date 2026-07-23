import { describe, expect, it } from "vitest";

import {
  getAllApiKeys,
  getEnvApiKeys,
  issueApiKey,
  revokeApiKey,
  verifyApiKey,
} from "@/lib/security/api-keys";

describe("API Key & Access Token Manager", () => {
  it("loads environment-configured API keys from process.env", () => {
    process.env.DEVPORTAL_SANDBOX_API_KEY = "test_sandbox_key_123";
    process.env.FEDERATION_API_KEY = "test_federation_key_456";

    const envKeys = getEnvApiKeys();
    expect(envKeys.some((k) => k.key === "test_sandbox_key_123")).toBe(true);
    expect(envKeys.some((k) => k.key === "test_federation_key_456")).toBe(true);

    const allKeys = getAllApiKeys();
    expect(allKeys.length).toBeGreaterThanOrEqual(2);
  });

  it("issues scoped API key with prefix devlogia_sk_", () => {
    const { record, secretKey } = issueApiKey({
      name: "GitHub Actions CI",
      scopes: ["posts:write", "analytics:read"],
      expiresDays: 30,
    });

    expect(secretKey).toMatch(/^devlogia_sk_[a-f0-9]+$/);
    expect(record.name).toBe("GitHub Actions CI");
    expect(record.scopes).toEqual(["posts:write", "analytics:read"]);
    expect(record.source).toBe("managed");
    expect(record.status).toBe("active");
    expect(record.expiresAt).not.toBeNull();
  });

  it("verifies API keys against required scopes", () => {
    const { secretKey } = issueApiKey({
      name: "Analytics Service",
      scopes: ["analytics:read"],
    });

    // Valid scope
    const validResult = verifyApiKey(secretKey, "analytics:read");
    expect(validResult.valid).toBe(true);

    // Invalid scope
    const invalidScopeResult = verifyApiKey(secretKey, "posts:write");
    expect(invalidScopeResult.valid).toBe(false);
    expect(invalidScopeResult.reason).toContain("lacks required scope");

    // Non-existent key
    const missingResult = verifyApiKey("invalid_key_999");
    expect(missingResult.valid).toBe(false);
  });

  it("revokes managed API keys", () => {
    const { record, secretKey } = issueApiKey({
      name: "Temporary Key",
      scopes: ["posts:read"],
    });

    expect(verifyApiKey(secretKey).valid).toBe(true);

    const revoked = revokeApiKey(record.id);
    expect(revoked).toBe(true);

    expect(verifyApiKey(secretKey).valid).toBe(false);
    expect(verifyApiKey(secretKey).reason).toContain("revoked");
  });
});
