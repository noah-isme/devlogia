import { describe, expect, it } from "vitest";

import { DevlogiaSDK } from "../index";

describe("DevlogiaSDK", () => {
  it("initializes feed, insights, federation, and auth modules", () => {
    const sdk = new DevlogiaSDK({ token: "test" });
    expect(sdk.feed).toBeDefined();
    expect(sdk.insights).toBeDefined();
    expect(sdk.federation).toBeDefined();
    expect(sdk.auth).toBeDefined();
  });
});
