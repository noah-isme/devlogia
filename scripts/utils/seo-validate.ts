import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd, buildOrganizationJsonLd, siteConfig } from "@/lib/seo";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function validateOrganization() {
  const schema = buildOrganizationJsonLd();
  assert(schema["@context"] === "https://schema.org", "Organization schema must include @context");
  assert(schema["@type"] === "Organization", "Organization schema must set @type");
  assert(typeof schema.logo === "string" && schema.logo.length > 0, "Organization schema requires logo");
}

function validateBreadcrumb() {
  const schema = buildBreadcrumbJsonLd([
    { name: "Home", url: siteConfig.url },
    { name: "Blog", url: `${siteConfig.url}/blog` },
  ]);
  assert(Array.isArray(schema.itemListElement) && schema.itemListElement.length === 2, "Breadcrumb requires items");
}

function validateBlogPosting() {
  const now = new Date().toISOString();
  const schema = buildBlogPostingJsonLd({
    title: "Validation",
    description: "SEO validation post",
    url: `${siteConfig.url}/blog/validation-post`,
    publishedAt: now,
    updatedAt: now,
    keywords: ["devlogia"],
    authorName: siteConfig.author,
  });
  assert(schema["@type"] === "BlogPosting", "BlogPosting schema must set @type");
  assert(schema.publisher?.name === siteConfig.name, "BlogPosting schema must include publisher name");
}

function main() {
  validateOrganization();
  validateBreadcrumb();
  validateBlogPosting();
  console.log("SEO schema validation passed");
}

main();
