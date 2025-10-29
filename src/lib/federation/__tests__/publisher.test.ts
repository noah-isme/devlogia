import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { buildFederationPayload, publishFederationIndex } from "@/lib/federation/indexer";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(async () => [
        {
          id: "post_1",
          slug: "hello-world",
          title: "Hello World",
          summary: "Intro post",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          tags: [{ tag: { slug: "news" } }],
          embedding: { vector: [0.1, 0.2] },
          federationIndex: null,
        },
      ]),
    },
  },
}));

describe("federation publisher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T12:00:00Z"));
    process.env.FEDERATION_INDEX_URL = "https://index.devlogia.test";
    process.env.FEDERATION_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("buildFederationPayload returns normalized structure", async () => {
    const payload = await buildFederationPayload({ limit: 10, tenantSlug: "acme" });

    expect(payload.tenant.slug).toBe("acme");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ slug: "hello-world", tags: ["news"] });
  });

  test("publishFederationIndex performs dry run without push", async () => {
    const result = await publishFederationIndex({ limit: 5, push: false });

    expect(result.status).toBe("dry-run");
    expect(result.payload.items[0]?.title).toBe("Hello World");
  });

  test("publishFederationIndex pushes payload when configured", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    const result = await publishFederationIndex({ limit: 5, push: true, fetchImpl: fetchMock });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.status).toBe("published");
  });
});
