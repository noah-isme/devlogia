import type { Metadata } from "next";

const defaultUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const ogSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" role="img" aria-labelledby="title">
    <title id="title">Devlogia</title>
    <rect width="1200" height="630" rx="48" fill="#0f172a" />
    <g fill="#e2e8f0" font-family="'Inter', 'Segoe UI', system-ui, sans-serif">
      <text x="80" y="280" font-size="128" font-weight="600">Devlogia</text>
      <text x="80" y="380" font-size="48" opacity="0.8">Developer-first personal blog CMS</text>
    </g>
  </svg>
`.trim();

const ogImageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(ogSvg)}`;

export const siteConfig = {
  name: "Devlogia",
  description:
    "Devlogia is a developer-first personal blog CMS with MDX, autosave, and production-ready workflows.",
  url: defaultUrl,
  author: "Devlogia",
  ogImage: ogImageDataUrl,
  twitter: "@devlogia",
};

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
    },
    alternates: {
      canonical: siteConfig.url,
    },
    ...overrides,
  };

  return metadata;
}
