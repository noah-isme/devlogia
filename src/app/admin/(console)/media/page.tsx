import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { auth } from "@/lib/auth";
import { isMediaUsedByContent } from "@/lib/cms/media";
import { can } from "@/lib/rbac";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Media library",
  description: "Search, reuse, and maintain uploaded media assets.",
});

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  if (!can(session.user, "media:view")) {
    redirect("/admin/dashboard");
  }

  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;
  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Media unavailable</p>
        <p>Configure the <code>DATABASE_URL</code> environment variable to load uploaded media.</p>
      </div>
    );
  }

  const [media, posts, pages] = await Promise.all([
    prisma.media.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.post.findMany({ select: { coverUrl: true, contentMdx: true } }),
    prisma.page.findMany({ select: { contentMdx: true } }),
  ]);
  const postCoverUrls = posts.map((post) => post.coverUrl).filter((coverUrl): coverUrl is string => Boolean(coverUrl));
  const postBodies = posts.map((post) => post.contentMdx);
  const pageBodies = pages.map((page) => page.contentMdx);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
        <p className="text-sm text-muted-foreground">Search uploads, copy reusable URLs, edit alt text, and flag unused assets.</p>
      </header>
      <MediaLibrary
        initialMedia={media.map((asset) => ({
          id: asset.id,
          path: asset.path,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          publicUrl: asset.publicUrl,
          alt: asset.alt,
          createdAt: asset.createdAt.toISOString(),
          unused: !isMediaUsedByContent(asset, { postCoverUrls, postBodies, pageBodies }),
        }))}
      />
    </div>
  );
}
