import { describe, expect, it } from "vitest";

import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd, buildOrganizationJsonLd, siteConfig } from "@/lib/seo";

describe("seo schema", () => {
  it("builds organization schema", () => {
    const schema = buildOrganizationJsonLd();
    expect(schema["@type"]).toBe("Organization");
    expect(schema.logo).toContain(siteConfig.logo);
  });

  it("builds breadcrumb schema with positions", () => {
    const schema = buildBreadcrumbJsonLd([
      { name: "Home", url: `${siteConfig.url}/` },
      { name: "Blog", url: `${siteConfig.url}/blog` },
    ]);

    expect(schema.itemListElement).toHaveLength(2);
    expect(schema.itemListElement[1].position).toBe(2);
  });

  it("builds blog posting schema", () => {
    const schema = buildBlogPostingJsonLd({
      title: "Test Post",
      description: "A test post",
      url: `${siteConfig.url}/blog/test-post`,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      keywords: ["test"],
    });

    expect(schema["@type"]).toBe("BlogPosting");
    expect(schema.publisher?.name).toBe(siteConfig.name);
  });
});
