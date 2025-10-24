import type { Metadata } from "next";

const defaultUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function createOgUrl(title?: string) {
  const ogUrl = new URL("/api/og", defaultUrl);
  if (title) {
    ogUrl.searchParams.set("title", title);
  }
  return ogUrl.toString();
}

export const siteConfig = {
  name: "Devlogia",
  description:
    "Devlogia is a developer-first personal blog CMS with MDX, autosave, and production-ready workflows.",
  url: defaultUrl,
  author: "Devlogia",
  ogImage: createOgUrl("Devlogia"),
  twitter: "@devlogia",
};

export function buildOgImageUrl(title?: string) {
  return createOgUrl(title);
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
