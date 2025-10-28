import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { PostShareSection } from "@/components/post-share-section";
import { FeedbackForm } from "@/components/feedback-form";
import { renderMdx } from "@/lib/mdx";
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildMetadata,
  buildOgImageUrl,
  siteConfig,
} from "@/lib/seo";
import { estimateReadingTime, formatDate, slugify } from "@/lib/utils";

export const revalidate = 60;

type PageProps = {
  params: { slug: string };
};

type PublishedSlug = {
  slug: string;
};

async function getPost(slug: string, prismaModule?: typeof import("@/lib/prisma")) {
  const moduleRef = prismaModule ?? (await import("@/lib/prisma"));
  const { prisma, isDatabaseEnabled } = moduleRef;

  if (!isDatabaseEnabled) {
    return null;
  }

  try {
    return await prisma.post.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: { author: true, tags: { include: { tag: true } } },
    });
  } catch (error) {
    console.error(`Failed to load post for slug "${slug}":`, error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const prismaModule = await import("@/lib/prisma");

  if (!prismaModule.isDatabaseEnabled) {
    return buildMetadata({ title: "Post unavailable" });
  }

  const post = await getPost(params.slug, prismaModule);
  if (!post) {
    return buildMetadata({ title: "Post not found" });
  }

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const keywords = post.tags.map(({ tag }) => tag.name);
  const ogImage = buildOgImageUrl({
    title: post.title,
    slug: post.slug,
    tags: post.tags.map(({ tag }) => tag.name),
    publishedAt: post.publishedAt ?? post.createdAt,
  });

  return buildMetadata({
    title: post.title,
    description: post.summary ?? siteConfig.description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.summary ?? siteConfig.description,
      url,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      tags: keywords,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary ?? siteConfig.description,
      images: [ogImage],
    },
    keywords,
  });
}

export async function generateStaticParams() {
  const prismaModule = await import("@/lib/prisma");

  if (!prismaModule.isDatabaseEnabled) {
    return [];
  }

  try {
    const posts = await prismaModule.safeFindMany<PublishedSlug>("post", {
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });

    return posts.map((post) => ({ slug: post.slug }));
  } catch (error) {
    console.error("Failed to load published posts for static params:", error);
    return [];
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const prismaModule = await import("@/lib/prisma");
  const post = await getPost(params.slug, prismaModule);

  if (!post) {
    if (!prismaModule.isDatabaseEnabled) {
      return (
        <article className="prose prose-neutral dark:prose-invert">
          <header className="not-prose mb-6 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Post unavailable</h1>
            <p className="text-sm text-muted-foreground">
              Configure the <code>DATABASE_URL</code> environment variable to load published articles.
            </p>
          </header>
        </article>
      );
    }

    notFound();
  }

  const content = await renderMdx(post.contentMdx);
  const tableOfContents = extractHeadings(post.contentMdx);
  const hasTableOfContents = tableOfContents.length >= 3;
  const shareUrl = `${siteConfig.url}/blog/${post.slug}`;
  const publishedAt = (post.publishedAt ?? post.createdAt).toISOString();
  const updatedAt = post.updatedAt.toISOString();
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Home", url: siteConfig.url },
    { name: "Blog", url: `${siteConfig.url}/blog` },
    { name: post.title, url: shareUrl },
  ]);
  const blogPosting = buildBlogPostingJsonLd({
    title: post.title,
    description: post.summary ?? siteConfig.description,
    url: shareUrl,
    publishedAt,
    updatedAt,
    keywords: post.tags.map(({ tag }) => tag.name),
    authorName: post.author?.email ?? siteConfig.author,
  });

  return (
    <article className="prose prose-neutral dark:prose-invert">
      <header className="not-prose mb-8 space-y-4">
        <p className="text-sm text-muted-foreground">
          {post.publishedAt ? formatDate(post.publishedAt) : "Draft"} · {estimateReadingTime(post.contentMdx)}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        {post.summary ? (
          <p className="max-w-2xl text-base text-muted-foreground">{post.summary}</p>
        ) : null}
        {post.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {post.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      {hasTableOfContents ? (
        <aside className="not-prose mb-8 rounded-lg border border-border bg-muted/30 p-4" aria-label="Table of contents">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">On this page</h2>
          <nav className="mt-3">
            <ol className="space-y-2 text-sm text-muted-foreground">
              {tableOfContents.map((item) => (
                <li
                  key={item.id}
                  className={item.level === 3 ? "pl-4" : item.level >= 4 ? "pl-6" : "pl-0"}
                >
                  <a href={`#${item.id}`} className="hover:text-foreground hover:underline">
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      ) : null}
      <PostShareSection url={shareUrl} title={post.title} />
      <div className="prose-headings:scroll-mt-24 prose-a:text-foreground prose-pre:bg-muted/60">
        {content}
      </div>
      <FeedbackForm slug={post.slug} />
      <JsonLd id="breadcrumbs-jsonld" data={breadcrumbs} />
      <JsonLd id="blogposting-jsonld" data={blogPosting} />
    </article>
  );
}

type TocEntry = {
  id: string;
  title: string;
  level: number;
};

function extractHeadings(source: string): TocEntry[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(#{2,4})\s+(.+)$/.exec(line);
      if (!match) {
        return null;
      }
      const level = match[1].length;
      const rawText = match[2]
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim();
      if (!rawText) {
        return null;
      }
      return {
        id: slugify(rawText),
        title: rawText,
        level,
      } satisfies TocEntry;
    })
    .filter((entry): entry is TocEntry => Boolean(entry));
}
