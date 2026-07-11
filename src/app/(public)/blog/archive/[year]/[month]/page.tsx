import type { Metadata } from "next";
import Link from "next/link";

import { buildArchiveHref, formatArchiveLabel, type BlogPostWithRelations } from "@/lib/blog-public";
import { buildMetadata, siteConfig } from "@/lib/seo";
import { estimateReadingTime, formatDate } from "@/lib/utils";

type ArchivePageProps = {
  readonly params: Promise<{ readonly year: string; readonly month: string }>;
};

function parseArchiveParams(year: string, month: string) {
  const yearNumber = Number.parseInt(year, 10);
  const monthNumber = Number.parseInt(month, 10);
  if (!Number.isInteger(yearNumber) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  const start = new Date(Date.UTC(yearNumber, monthNumber - 1, 1));
  const end = new Date(Date.UTC(yearNumber, monthNumber, 1));
  return { start, end, label: formatArchiveLabel(start) };
}

export async function generateMetadata({ params }: ArchivePageProps): Promise<Metadata> {
  const { year, month } = await params;
  const archive = parseArchiveParams(year, month);
  const label = archive?.label ?? `${year}/${month}`;

  return buildMetadata({
    title: `${label} archive`,
    description: `Browse Devlogia posts published in ${label}.`,
    alternates: { canonical: `${siteConfig.url}/blog/archive/${year}/${month}` },
  });
}

export default async function ArchivePage({ params }: ArchivePageProps) {
  const { year, month } = await params;
  const archive = parseArchiveParams(year, month);

  if (!archive) {
    return <ArchiveUnavailable title="Archive not found" description="Use a four-digit year and two-digit month to browse the public archive." />;
  }

  const prismaModule = await import("@/lib/prisma");
  if (!prismaModule.isDatabaseEnabled) {
    return <ArchiveUnavailable title="Archive unavailable" description="Set DATABASE_URL to load published posts by month." />;
  }

  const posts = await prismaModule.safeFindMany<BlogPostWithRelations>("post", {
    where: { status: "PUBLISHED", publishedAt: { gte: archive.start, lt: archive.end } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { author: true, tags: { include: { tag: true } } },
  });

  return (
    <section className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{archive.label}</li>
        </ol>
      </nav>
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Archive</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{archive.label}</h1>
        <p className="max-w-2xl text-base text-muted-foreground">Browse posts by publication month without losing the public blog context.</p>
      </header>
      {posts.length ? <ArchivePostList posts={posts} /> : <ArchiveUnavailable title={`No posts in ${archive.label}`} description="Return to the full blog archive to browse every published post." />}
    </section>
  );
}

function ArchivePostList({ posts }: { readonly posts: readonly BlogPostWithRelations[] }) {
  return (
    <div className="space-y-8">
      {posts.map((post) => (
        <article key={post.id} className="rounded-lg border border-border bg-muted/20 p-5">
          <p className="text-sm text-muted-foreground">
            <Link href={buildArchiveHref(post.publishedAt ?? post.createdAt)} className="hover:text-foreground hover:underline">
              {formatDate(post.publishedAt ?? post.createdAt)}
            </Link>{" "}
            · {estimateReadingTime(post.contentMdx)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            <Link href={`/blog/${post.slug}`} className="hover:underline">{post.title}</Link>
          </h2>
          {post.summary ? <p className="mt-2 text-base text-muted-foreground">{post.summary}</p> : null}
        </article>
      ))}
    </div>
  );
}

function ArchiveUnavailable({ title, description }: { readonly title: string; readonly description: string }) {
  return (
    <div role="status" className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2">{description}</p>
      <Link href="/blog" className="mt-4 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline">
        Back to all posts
      </Link>
    </div>
  );
}
