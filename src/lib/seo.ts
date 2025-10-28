import type { Metadata } from "next";

const defaultUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

type OgImageOptions =
  | string
  | {
      title?: string;
      slug?: string;
      tags?: string[];
      publishedAt?: Date | string | null;
    };

function createOgUrl(options?: OgImageOptions) {
  const ogUrl = new URL("/api/og", defaultUrl);
  if (!options) {
    return ogUrl.toString();
  }

  if (typeof options === "string") {
    if (options) {
      ogUrl.searchParams.set("title", options);
    }
    return ogUrl.toString();
  }

  const { title, slug, tags, publishedAt } = options;
  if (title) {
    ogUrl.searchParams.set("title", title);
  }
  if (slug) {
    ogUrl.searchParams.set("slug", slug);
  }
  const primaryTag = tags?.[0];
  if (primaryTag) {
    ogUrl.searchParams.set("tag", primaryTag);
  }
  if (publishedAt) {
    const iso = typeof publishedAt === "string" ? publishedAt : publishedAt.toISOString();
    ogUrl.searchParams.set("date", iso);
  }

  return ogUrl.toString();
}

export const siteConfig = {
  name: "Devlogia",
  description:
    "Devlogia is a developer-first personal blog CMS with MDX, autosave, and production-ready workflows.",
  url: defaultUrl,
  author: "Devlogia",
  ogImage: createOgUrl({ title: "Devlogia" }),
  twitter: "@devlogia",
  logo: "/og-default.png",
  organization: {
    legalName: "Devlogia Labs",
    foundingDate: "2023-01-01",
  },
};

export function buildOgImageUrl(options?: OgImageOptions) {
  return createOgUrl(options);
}

export function buildMetadata(overrides: Metadata = {}): Metadata {
  const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.name,
      template: `%s · ${siteConfig.name}`,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.author }],
    openGraph: {
      title: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
      images: [siteConfig.ogImage],
    },
    alternates: {
      canonical: siteConfig.url,
    },
    ...overrides,
  };

  return metadata;
}

type BlogPostingJsonLdOptions = {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  updatedAt: string;
  keywords?: string[];
  authorName?: string;
};

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    legalName: siteConfig.organization.legalName,
    url: siteConfig.url,
    logo: new URL(siteConfig.logo, siteConfig.url).toString(),
    sameAs: [
      `https://twitter.com/${siteConfig.twitter.replace(/^@/, "")}`,
    ],
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildBlogPostingJsonLd(options: BlogPostingJsonLdOptions) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: options.title,
    description: options.description,
    url: options.url,
    mainEntityOfPage: options.url,
    datePublished: options.publishedAt,
    dateModified: options.updatedAt,
    author: {
      "@type": "Person",
      name: options.authorName ?? siteConfig.author,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: new URL(siteConfig.logo, siteConfig.url).toString(),
      },
    },
    keywords: options.keywords,
  };
}

export async function notifySearchEngines(sitemapUrl?: string) {
  const sitemap = sitemapUrl ?? `${siteConfig.url}/sitemap.xml`;
  const targets = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
  ];

  await Promise.allSettled(
    targets.map(async (target) => {
      try {
        const response = await fetch(target, { method: "GET" });
        if (!response.ok) {
          console.warn(`Failed to ping search engine: ${target} responded with ${response.status}`);
        }
      } catch (error) {
        console.warn(`Unable to ping search engine ${target}`, error);
      }
    }),
  );
}
