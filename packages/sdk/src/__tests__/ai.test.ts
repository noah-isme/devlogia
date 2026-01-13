import { describe, it, expect } from "vitest";
import { DevlogiaSDK } from "../index";
import {
  createMockFetch,
  mockFetchSuccess,
  mockFetchError,
} from "./test-utils";

describe("AIModule", () => {
  describe("listExtensions", () => {
    it("sends GET request to /api/ai/extensions with tenantId", async () => {
      const mockFetch = createMockFetch();
      const extensions = [
        {
          id: "ext-1",
          tenantId: "tenant-123",
          name: "Writer AI",
          provider: "openai",
          model: "gpt-4",
          capability: "writer",
          tokenCost: 100,
          description: null,
          metadata: null,
          active: true,
          monthlyTokens: 5000,
          monthlyCostCents: 250,
          totalInvocations: 42,
        },
      ];
      mockFetch.mockResolvedValue(mockFetchSuccess({ extensions }) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.ai.listExtensions({ tenantId: "tenant-123" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/ai/extensions");
      expect(url).toContain("tenantId=tenant-123");
      expect(result).toEqual(extensions);
    });

    it("includes includeInactive flag when true", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchSuccess({ extensions: [] }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await sdk.ai.listExtensions({
        tenantId: "tenant-123",
        includeInactive: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("includeInactive=true");
    });
  });

  describe("createExtension", () => {
    it("sends POST request to /api/ai/extensions", async () => {
      const mockFetch = createMockFetch();
      const newExtension = {
        id: "ext-new",
        tenantId: "tenant-123",
        name: "SEO AI",
        provider: "openai",
        model: "gpt-4",
        capability: "seo",
        tokenCost: 50,
        description: "SEO optimization",
        metadata: null,
        active: true,
        monthlyTokens: 0,
        monthlyCostCents: 0,
        totalInvocations: 0,
      };
      mockFetch.mockResolvedValue(
        mockFetchSuccess({ extension: newExtension }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const payload = {
        tenantId: "tenant-123",
        name: "SEO AI",
        model: "gpt-4",
        capability: "seo",
      };
      const result = await sdk.ai.createExtension(payload);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/ai/extensions");
      expect(options?.method).toBe("POST");
      expect(JSON.parse(options?.body as string)).toEqual(payload);
      expect(result).toEqual(newExtension);
    });
  });

  describe("logUsage", () => {
    it("sends POST request to /api/ai/usage with usage data", async () => {
      const mockFetch = createMockFetch();
      const usageResponse = {
        logId: "log-123",
        quota: {
          limit: 100000,
          used: 5000,
          remaining: 95000,
          utilization: 0.05,
          warnings: [],
        },
        warnings: [],
      };
      mockFetch.mockResolvedValue(mockFetchSuccess(usageResponse) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const payload = {
        tenantId: "tenant-123",
        userId: "user-456",
        extensionId: "ext-1",
        tokensUsed: 500,
        costCents: 25,
      };
      const result = await sdk.ai.logUsage(payload);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/ai/usage");
      expect(options?.method).toBe("POST");
      expect(JSON.parse(options?.body as string)).toEqual(payload);
      expect(result).toEqual(usageResponse);
    });

    it("returns quota warnings when present", async () => {
      const mockFetch = createMockFetch();
      const usageResponse = {
        logId: "log-456",
        quota: {
          limit: 100000,
          used: 85000,
          remaining: 15000,
          utilization: 0.85,
          warnings: [
            {
              level: "warning",
              threshold: 0.8,
              utilization: 0.85,
              message: "80% quota used",
            },
          ],
        },
        warnings: [
          {
            level: "warning",
            threshold: 0.8,
            utilization: 0.85,
            message: "80% quota used",
          },
        ],
      };
      mockFetch.mockResolvedValue(mockFetchSuccess(usageResponse) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.ai.logUsage({
        tenantId: "t",
        userId: "u",
        extensionId: "e",
        tokensUsed: 100,
      });

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].level).toBe("warning");
    });
  });

  describe("listWorkspaces", () => {
    it("sends GET request to /api/workspaces with tenantId", async () => {
      const mockFetch = createMockFetch();
      const workspaces = [
        {
          id: "ws-1",
          name: "Engineering",
          slug: "engineering",
          createdAt: "2026-01-01T00:00:00Z",
          members: [
            {
              id: "m-1",
              role: "OWNER",
              joinedAt: "2026-01-01",
              user: { id: "u-1", email: "owner@test.com" },
            },
          ],
          sessions: [],
        },
      ];
      mockFetch.mockResolvedValue(mockFetchSuccess({ workspaces }) as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const result = await sdk.ai.listWorkspaces({ tenantId: "tenant-123" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/workspaces");
      expect(url).toContain("tenantId=tenant-123");
      expect(result).toEqual(workspaces);
    });
  });

  describe("createWorkspace", () => {
    it("sends POST request to /api/workspaces", async () => {
      const mockFetch = createMockFetch();
      const newWorkspace = {
        id: "ws-new",
        name: "Design",
        slug: "design",
        createdAt: "2026-01-13T00:00:00Z",
        members: [],
        sessions: [],
      };
      mockFetch.mockResolvedValue(
        mockFetchSuccess({ workspace: newWorkspace }) as Response,
      );

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      const payload = { tenantId: "tenant-123", name: "Design" };
      const result = await sdk.ai.createWorkspace(payload);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/workspaces");
      expect(options?.method).toBe("POST");
      expect(result).toEqual(newWorkspace);
    });
  });

  describe("error handling", () => {
    it("throws on 401 Unauthorized", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(
        mockFetchError(401, "Unauthorized") as Response,
      );

      const sdk = new DevlogiaSDK({ token: "bad-token", fetcher: mockFetch });
      await expect(sdk.ai.listExtensions({ tenantId: "t" })).rejects.toThrow(
        "401",
      );
    });

    it("throws on 404 Not Found", async () => {
      const mockFetch = createMockFetch();
      mockFetch.mockResolvedValue(mockFetchError(404, "Not Found") as Response);

      const sdk = new DevlogiaSDK({ token: "test-token", fetcher: mockFetch });
      await expect(
        sdk.ai.logUsage({ tenantId: "t", userId: "u", extensionId: "missing" }),
      ).rejects.toThrow("404");
    });
  });
});
