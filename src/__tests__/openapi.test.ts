import { describe, expect, test } from "vitest";

import { openApiDocument } from "@/lib/openapi/document";

describe("OpenAPI document", () => {
  test("includes primary public endpoints", () => {
    const paths = openApiDocument.paths ?? {};
    expect(paths["/api/posts"]).toBeDefined();
    expect(paths["/api/pages"]).toBeDefined();
    expect(paths["/api/analytics"]).toBeDefined();
    expect(paths["/api/uploadthing"]).toBeDefined();
  });

  test("categorises operations by tags", () => {
    const analytics = openApiDocument.paths?.["/api/analytics"]?.get;
    expect(Array.isArray(analytics?.tags)).toBe(true);
    expect(analytics?.tags).toContain("Analytics");

    const posts = openApiDocument.paths?.["/api/posts"]?.get;
    expect(posts?.tags).toContain("Content");
  });
});
