import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { renderMdx } from "@/lib/mdx";
import { verifyDraftPreviewToken } from "@/lib/cms/preview-token";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ token?: string }>;
};

export default async function DraftPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token || !verifyDraftPreviewToken(token, id)) {
    notFound();
  }

  const { prisma } = await import("@/lib/prisma");
  const post = await prisma.post.findUnique({ where: { id }, include: { tags: { include: { tag: true } } } });
  if (!post) {
    notFound();
  }

  const content = await renderMdx(post.contentMdx);

  return (
    <article className="prose prose-neutral dark:prose-invert">
      <header className="not-prose mb-8 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Draft preview</p>
        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        {post.summary ? <p className="max-w-2xl text-base text-muted-foreground">{post.summary}</p> : null}
      </header>
      {content}
    </article>
  );
}
