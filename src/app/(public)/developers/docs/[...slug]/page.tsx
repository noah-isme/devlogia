import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsTableOfContents } from "@/components/devportal/DocsTableOfContents";
import { extractDocHeadings, findDeveloperDoc, developerDocs } from "@/lib/devportal/docs";
import { renderMdx } from "@/lib/mdx";
import { buildMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return developerDocs.map((doc) => ({ slug: doc.slug }));
}

type PageProps = {
  params: { slug?: string[] };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const doc = findDeveloperDoc(params.slug ?? []);
  if (!doc) {
    return buildMetadata({ title: "Developer doc not found" });
  }

  return buildMetadata({
    title: `${doc.title} · Devlogia Developer Docs`,
    description: doc.description,
    alternates: { canonical: `https://devlogia.app/developers/docs/${doc.slug.join("/")}` },
  });
}

export default async function DeveloperDocPage({ params }: PageProps) {
  const doc = findDeveloperDoc(params.slug ?? []);
  if (!doc) {
    notFound();
  }

  const content = await renderMdx(doc.content);
  const toc = extractDocHeadings(doc.content);

  return (
    <article className="prose prose-neutral dark:prose-invert">
      <header className="not-prose mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{doc.category}</p>
        <h1 className="text-4xl font-bold tracking-tight">{doc.title}</h1>
        <p className="max-w-3xl text-base text-muted-foreground">{doc.description}</p>
      </header>
      <DocsTableOfContents entries={toc} />
      <div className="prose-headings:scroll-mt-24 prose-a:text-primary prose-code:bg-muted/40 prose-pre:bg-muted/50">
        {content}
      </div>
    </article>
  );
}
