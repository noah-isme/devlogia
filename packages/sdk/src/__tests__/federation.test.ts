import { describe, it, expect } from "vitest";
import { DevlogiaSDK } from "../index";
import {
  createMockFetch,
  mockFetchSuccess,
  mockFetchError,
} from "./test-utils";

describe("FederationModule", () => {
  describe("query", () => {
    it("sends POST request to /api/federation/query", async () => {
      const mockFetch = createMockFetch();
      const federationResponse = {
        items: [
          {
            id: "fed-1",
            title: "Federated Post",
            score: 0.95,
            excerpt: "Summary",
            publishedAt: "2026-01-13",
          },
        ],
        latencyMs: 42,
        fallback: false,
      };
      mockFetch.mockResolvedValue(
        mockFetchSuccess(federationResponse) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.federation.query({ query: "search term" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/federation/query");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toMatchObject({
        "Content-Type": "application/json",
      });
      expect(result).toEqual(federationResponse);
    });

    it("sends query string in request body", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          items: [],
          latencyMs: 0,
          fallback: false,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.federation.query({ query: "typescript best practices" });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual({
        query: "typescript best practices",
      });
    });

    it("sends limit in request body when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          items: [],
          latencyMs: 0,
          fallback: false,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.federation.query({ query: "test", limit: 5 });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual({
        query: "test",
        limit: 5,
      });
    });

    it("sends tags array in request body when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          items: [],
          latencyMs: 0,
          fallback: false,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.federation.query({ tags: ["react", "nextjs"] });

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual({
        tags: ["react", "nextjs"],
      });
    });

    it("includes Authorization header", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          items: [],
          latencyMs: 0,
          fallback: false,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "fed-token", fetcher: mockFetch });
      await sdk.federation.query({});

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer fed-token",
      });
    });

    it("throws error on non-OK response", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchError(503, "Service Unavailable") as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await expect(sdk.federation.query({ query: "test" })).rejects.toThrow(
        "503",
      );
    });
  });
});
