import { describe, it, expect } from "vitest";
import { DevlogiaSDK } from "../index";
import {
  createMockFetch,
  mockFetchSuccess,
  mockFetchError,
} from "./test-utils";

describe("AuthModule", () => {
  describe("exchange", () => {
    it("sends POST request to /api/auth/sdk-exchange with api key", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          token: "new-token",
          expiresAt: "2026-01-14T00:00:00Z",
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.auth.exchange({ apiKey: "my-api-key" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/auth/sdk-exchange");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(options?.body as string)).toEqual({
        apiKey: "my-api-key",
      });
      expect(result).toEqual({
        token: "new-token",
        expiresAt: "2026-01-14T00:00:00Z",
      });
    });

    it("includes tenantId in request body when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          token: "tenant-token",
          expiresAt: "2026-01-14T00:00:00Z",
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.auth.exchange({ apiKey: "my-api-key", tenantId: "tenant-123" });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual({
        apiKey: "my-api-key",
        tenantId: "tenant-123",
      });
    });

    it("throws error on non-OK response", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchError(401, "Unauthorized") as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await expect(sdk.auth.exchange({ apiKey: "bad-key" })).rejects.toThrow(
        "401",
      );
    });
  });
});
