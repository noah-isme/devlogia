import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderMdx } from "@/lib/mdx";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { buildMetadata, buildOgImageUrl, siteConfig } from "@/lib/seo";
import { estimateReadingTime, formatDate } from "@/lib/utils";

export const revalidate = 60;

type PageProps = {
  params: { slug: string };
};

async function getPost(slug: string) {
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
  if (!isDatabaseEnabled) {
    return buildMetadata({ title: "Post unavailable" });
  }

  const post = await getPost(params.slug);
  if (!post) {
    return buildMetadata({ title: "Post not found" });
  }

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const ogImage = buildOgImageUrl(post.title);

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
  });
}

export async function generateStaticParams() {
  if (!isDatabaseEnabled) {
    return [];
  }

  try {
    const posts = await prisma.post.findMany({
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
  const post = await getPost(params.slug);

  if (!post) {
    if (!isDatabaseEnabled) {
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
      <div className="prose-headings:scroll-mt-24 prose-a:text-foreground prose-pre:bg-muted/60">
        {content}
      </div>
    </article>
  );
}
