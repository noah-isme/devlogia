import { describe, it, expect } from "vitest";
import { DevlogiaSDK } from "../index";
import {
  createMockFetch,
  mockFetchSuccess,
  mockFetchError,
} from "./test-utils";

describe("FeedModule", () => {
  describe("list", () => {
    it("sends GET request to /api/feed", async () => {
      const mockFetch = createMockFetch();
      const feedItems = {
        items: [
          {
            id: "post-1",
            title: "First Post",
            summary: null,
            publishedAt: "2026-01-13",
            tags: ["tech"],
          },
        ],
      };
      mockFetch.mockResolvedValue(mockFetchSuccess(feedItems) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.feed.list();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/feed");
      expect(result).toEqual(feedItems);
    });

    it("includes limit query parameter when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchSuccess({ items: [] }) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.feed.list({ limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=10");
    });

    it("includes tag query parameter when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchSuccess({ items: [] }) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.feed.list({ tag: "javascript" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("tag=javascript");
    });

    it("includes both limit and tag when provided", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchSuccess({ items: [] }) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.feed.list({ limit: 5, tag: "react" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("limit=5");
      expect(url).toContain("tag=react");
    });

    it("includes Authorization header with Bearer token", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchSuccess({ items: [] }) as Response);

      const sdk = new DevlogiaSDK({
        token: "my-secret-token",
        fetcher: mockFetch,
      });
      await sdk.feed.list();

      const [, options] = mockFetch.mock.calls[0];
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer my-secret-token",
      });
    });

    it("throws error on non-OK response", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchError(500, "Server Error") as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await expect(sdk.feed.list()).rejects.toThrow("500");
    });
  });
});
