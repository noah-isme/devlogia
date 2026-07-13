import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderMdx } from "@/lib/mdx";
import { buildMetadata, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getPage(
  slug: string,
  prismaModule?: typeof import("@/lib/prisma"),
) {
  const moduleRef = prismaModule ?? (await import("@/lib/prisma"));
  const { prisma, isDatabaseEnabled } = moduleRef;

  if (!isDatabaseEnabled) {
    return null;
  }

  try {
    return await prisma.page.findFirst({ where: { slug, published: true } });
  } catch (error) {
    console.error(`Failed to load page for slug "${slug}":`, error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const prismaModule = await import("@/lib/prisma");
  const { slug } = await params;

  if (!prismaModule.isDatabaseEnabled) {
    return buildMetadata({ title: "Page unavailable" });
  }

  const page = await getPage(slug, prismaModule);
  if (!page) {
    return buildMetadata({ title: "Page not found" });
  }

  const url = `${siteConfig.url}/${page.slug}`;

  return buildMetadata({
    title: page.title,
    description: page.contentMdx.slice(0, 160),
    alternates: { canonical: url },
  });
}

export default async function StaticPage({ params }: PageProps) {
  const prismaModule = await import("@/lib/prisma");
  const { slug } = await params;
  const page = await getPage(slug, prismaModule);
  if (!page) {
    if (!prismaModule.isDatabaseEnabled) {
      return (
        <article className="prose prose-neutral dark:prose-invert">
          <header className="not-prose mb-6 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Page unavailable
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure the <code>DATABASE_URL</code> environment variable to
              load this page content.
            </p>
          </header>
        </article>
      );
    }

    notFound();
  }

  const content = await renderMdx(page.contentMdx);

  return (
    <article className="mx-auto max-w-5xl">
      <header className="mb-12 border-b border-border/70 pb-10 sm:pb-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {siteConfig.name}
        </p>
        <h1 className="text-balance mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
          {page.title}
        </h1>
      </header>
      <div className="prose prose-lg mx-auto max-w-3xl prose-neutral prose-headings:scroll-mt-24 prose-headings:tracking-[-0.025em] prose-p:leading-8 prose-a:text-primary prose-pre:rounded-2xl prose-pre:bg-foreground dark:prose-invert">
        {content}
      </div>
    </article>
  );
}
