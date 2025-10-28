import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/seo";

const resolvedUrl = new URL(siteConfig.url);
const productionOrigin = resolvedUrl.origin;

export default function robots(): MetadataRoute.Robots {
  const sitemapUrl = `${productionOrigin}/sitemap.xml`;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/admin"],
    },
    sitemap: [sitemapUrl],
    host: resolvedUrl.host,
  } satisfies MetadataRoute.Robots;
}
