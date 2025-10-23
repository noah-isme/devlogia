import type { Metadata } from "next";

import { PageManager, type PageSummary } from "@/components/forms/page-manager";
import { isDatabaseEnabled, prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pages",
  description: "Manage static pages for your site.",
});

export default async function PagesPage() {
  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Pages unavailable</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to load and manage static pages.
        </p>
      </div>
    );
  }

  let summaries: PageSummary[] | null = null;

  try {
    const pages = await prisma.page.findMany({ orderBy: { updatedAt: "desc" } });
    summaries = pages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      contentMdx: page.contentMdx,
      published: page.published,
    }));
  } catch (error) {
    console.error("Failed to load pages", error);
  }

  if (!summaries) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Pages unavailable</p>
        <p>We couldn&apos;t load pages. Verify your database connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="text-sm text-muted-foreground">
          Create and publish static pages such as About and Contact.
        </p>
      </header>
      <PageManager initialPages={summaries} />
    </div>
  );
}
