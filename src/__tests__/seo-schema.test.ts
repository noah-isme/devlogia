import { describe, expect, it } from "vitest";

import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd, buildOgImageUrl, buildOrganizationJsonLd, siteConfig } from "@/lib/seo";

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

  it("builds a branded OG fallback URL when post details are missing", () => {
    const url = new URL(buildOgImageUrl());

    expect(url.pathname).toBe("/api/og");
    expect(url.searchParams.get("title")).toBe("Devlogia");
    expect(url.searchParams.get("fallback")).toBe("brand");
  });

  it("keeps tag and archive details in post OG URLs", () => {
    const url = new URL(
      buildOgImageUrl({
        title: "Scaling Prisma",
        slug: "scaling-prisma",
        tags: ["Prisma"],
        publishedAt: new Date("2024-02-15T00:00:00.000Z"),
      }),
    );

    expect(url.searchParams.get("title")).toBe("Scaling Prisma");
    expect(url.searchParams.get("tag")).toBe("Prisma");
    expect(url.searchParams.get("date")).toBe("2024-02-15T00:00:00.000Z");
    expect(url.searchParams.get("fallback")).toBe("brand");
  });
});
