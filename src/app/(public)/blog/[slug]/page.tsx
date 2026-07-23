import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditorialCover } from "@/components/blog/editorial-cover";
import { BookmarkButton } from "@/components/blog/bookmark-button";
import { CommentSection } from "@/components/blog/comment-section";
import { PostReactions } from "@/components/blog/post-reactions";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { extractHeadings } from "@/lib/toc";
import { RelatedPosts } from "@/components/related-posts";
import { JsonLd } from "@/components/json-ld";
import { PostShareSection } from "@/components/post-share-section";
import { FeedbackForm } from "@/components/feedback-form";
import { KeyHighlights } from "@/components/personalization/KeyHighlights";
import { PersonalizedFeedSection } from "@/components/personalization/PersonalizedFeedSection";
import { AudioArticlePlayer } from "@/components/blog/audio-player";
import { ArticleTranslationControl } from "@/components/blog/article-translation-control";
import { renderMdx } from "@/lib/mdx";
import { calculateReadingTime } from "@/lib/reading-time";
import { buildTagHref, type BlogPostWithRelations } from "@/lib/blog-public";
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildMetadata,
  buildOgImageUrl,
  siteConfig,
} from "@/lib/seo";
import { formatDate } from "@/lib/utils";

export const revalidate = 60;

type PageProps = {
  params: Promise<{ slug: string }>;
};

type PublishedSlug = {
  slug: string;
};

async function getPost(
  slug: string,
  prismaModule?: typeof import("@/lib/prisma"),
) {
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

async function getRelatedPosts(
  post: BlogPostWithRelations,
  prismaModule: typeof import("@/lib/prisma"),
) {
  const tagSlugs = post.tags.map(({ tag }) => tag.slug);
  if (tagSlugs.length === 0) {
    return [];
  }

  return prismaModule.safeFindMany<BlogPostWithRelations>("post", {
    where: {
      status: "PUBLISHED",
      NOT: { id: post.id },
      tags: { some: { tag: { slug: { in: tagSlugs } } } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
    include: { author: true, tags: { include: { tag: true } } },
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const prismaModule = await import("@/lib/prisma");
  const { slug } = await params;

  if (!prismaModule.isDatabaseEnabled) {
    return buildMetadata({ title: "Post unavailable" });
  }

  const post = await getPost(slug, prismaModule);
  if (!post) {
    return buildMetadata({ title: "Post not found" });
  }

  const url = `${siteConfig.url}/blog/${post.slug}`;
  const metaTitle = post.seoTitle || post.title;
  const metaDescription = post.seoDescription || post.summary || siteConfig.description;
  const canonicalUrl = post.canonicalUrl || url;
  const keywords = post.tags.map(({ tag }) => tag.name);
  const defaultOgImage = buildOgImageUrl({
    title: post.title,
    slug: post.slug,
    tags: post.tags.map(({ tag }) => tag.name),
    publishedAt: post.publishedAt ?? post.createdAt,
  });
  const ogImage = post.ogImageUrl || defaultOgImage;

  return buildMetadata({
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonicalUrl,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      tags: keywords,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: metaTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
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
  const { slug } = await params;
  const post = await getPost(slug, prismaModule);

  if (!post) {
    if (!prismaModule.isDatabaseEnabled) {
      return (
        <article className="prose prose-neutral dark:prose-invert">
          <header className="not-prose mb-6 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Post unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure the <code>DATABASE_URL</code> environment variable to
              load published articles.
            </p>
          </header>
        </article>
      );
    }

    notFound();
  }

  const content = await renderMdx(post.contentMdx);
  const relatedPosts = await getRelatedPosts(post, prismaModule);
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
    <article>
      <nav
        aria-label="Breadcrumb"
        className="mb-8 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true" className="text-border">
            /
          </li>
          <li>
            <Link href="/blog">Journal</Link>
          </li>
          <li aria-hidden="true" className="text-border">
            /
          </li>
          <li aria-current="page" className="max-w-56 truncate text-foreground">
            {post.title}
          </li>
        </ol>
      </nav>

      <header className="mb-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
        <div className="order-2 space-y-6 lg:order-1">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <span>{post.tags[0]?.tag.name ?? "Devlogia Journal"}</span>
            <span
              className="h-1 w-1 rounded-full bg-border"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {post.publishedAt ? formatDate(post.publishedAt) : "Draft"}
            </span>
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            {post.title}
          </h1>
          {post.summary ? (
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {post.summary}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border/70 pt-5 text-sm">
            <div>
              <p className="font-semibold text-foreground">
                Devlogia Editorial
              </p>
              <p className="text-xs text-muted-foreground">
                {post.author?.email ?? siteConfig.author}
              </p>
            </div>
            <span className="h-8 w-px bg-border" aria-hidden="true" />
            <p className="text-muted-foreground">
              {calculateReadingTime(post.contentMdx).text}
            </p>
            {post.tags.length ? (
              <div className="flex flex-wrap gap-2">
                {post.tags.slice(0, 3).map(({ tag }) => (
                  <Link
                    key={tag.id}
                    href={buildTagHref(tag.slug)}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:no-underline"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {post.coverUrl ? (
          <div className="order-1 aspect-video min-h-[20rem] w-full overflow-hidden rounded-3xl bg-muted shadow-2xl lg:order-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverUrl}
              alt={post.title}
              className="h-full w-full object-cover transition-all"
            />
          </div>
        ) : (
          <EditorialCover
            title={post.title}
            eyebrow={post.tags[0]?.tag.name ?? "Featured perspective"}
            className="order-1 min-h-[24rem] lg:order-2"
          />
        )}
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 border-t border-border/70 pt-10 lg:grid-cols-[minmax(0,47rem)_17rem] lg:gap-16">
        <div className="min-w-0">
          <div className="mb-6 space-y-4">
            <AudioArticlePlayer title={post.title} contentMdx={post.contentMdx} />
            <ArticleTranslationControl
              postId={post.id}
              initialTitle={post.title}
              initialSummary={post.summary ?? ""}
              initialContentMdx={post.contentMdx}
            />
          </div>
          <div className="mb-10">
            <KeyHighlights slug={post.slug} />
          </div>
          <div className="prose prose-lg max-w-none prose-neutral prose-headings:scroll-mt-24 prose-headings:tracking-[-0.025em] prose-p:leading-8 prose-a:text-primary prose-pre:rounded-2xl prose-pre:bg-foreground dark:prose-invert">
            {content}
          </div>
          <div className="mt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-border/70 pt-10">
            <PostShareSection url={shareUrl} title={post.title} />
            <BookmarkButton postId={post.id} postTitle={post.title} />
          </div>
          <PostReactions postId={post.id} />
          <FeedbackForm slug={post.slug} />
          <CommentSection postId={post.id} />
        </div>

        <aside
          className="space-y-6 lg:sticky lg:top-28 lg:self-start"
          aria-label="Article tools"
        >
          <TableOfContents headings={extractHeadings(post.contentMdx)} />
          <section className="rounded-2xl bg-foreground p-5 text-background">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-background/55">
              Reading principle
            </p>
            <p className="mt-3 text-sm leading-6 text-background/80">
              Save what is useful. Question what is familiar. Share what moves
              the work forward.
            </p>
          </section>
        </aside>
      </div>

      <div className="mx-auto max-w-6xl">
        <RelatedPosts posts={relatedPosts} />
        <div className="mt-10">
          <PersonalizedFeedSection
            contextPostId={post.id}
            title="Continue your reading journey"
          />
        </div>
      </div>
      <JsonLd id="breadcrumbs-jsonld" data={breadcrumbs} />
      <JsonLd id="blogposting-jsonld" data={blogPosting} />
    </article>
  );
}
