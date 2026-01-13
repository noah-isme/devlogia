import { describe, it, expect } from "vitest";
import { DevlogiaSDK } from "../index";
import {
  createMockFetch,
  mockFetchSuccess,
  mockFetchError,
} from "./test-utils";

describe("InsightsModule", () => {
  describe("summary", () => {
    it("sends GET request to /api/insights with default 30d timeframe", async () => {
      const mockFetch = createMockFetch();
      const insightData = {
        timeframe: "30d",
        topPages: [{ slug: "/blog/test", views: 100, sessions: 50 }],
        sentimentScore: 0.85,
        aiUsageUsd: 12.5,
      };
      mockFetch.mockResolvedValue(mockFetchSuccess(insightData) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.insights.summary();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/insights");
      expect(url).toContain("timeframe=30d");
      expect(result).toEqual(insightData);
    });

    it("sends GET request with 7d timeframe when specified", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          timeframe: "7d",
          topPages: [],
          sentimentScore: 0,
          aiUsageUsd: 0,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.insights.summary("7d");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("timeframe=7d");
    });

    it("sends GET request with 90d timeframe when specified", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          timeframe: "90d",
          topPages: [],
          sentimentScore: 0,
          aiUsageUsd: 0,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.insights.summary("90d");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("timeframe=90d");
    });

    it("includes Authorization header", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({
          timeframe: "30d",
          topPages: [],
          sentimentScore: 0,
          aiUsageUsd: 0,
        }) as Response,
      );

      const sdk = new DevlogiaSDK({
        token: "insight-token",
        fetcher: mockFetch,
      });
      await sdk.insights.summary();

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer insight-token",
      });
    });

    it("throws error on non-OK response", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchError(403, "Forbidden") as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await expect(sdk.insights.summary()).rejects.toThrow("403");
    });
  });
});
