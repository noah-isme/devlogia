import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { PostEditor } from "@/components/editor/Editor";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

type PageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return buildMetadata({ title: "Post unavailable" });
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { title: true },
    });

    if (!post) {
      return buildMetadata({ title: "Post not found" });
    }

    return buildMetadata({
      title: `Edit · ${post.title}`,
      description: `Edit ${post.title} in the Devlogia editor.`,
    });
  } catch (error) {
    console.error(`Failed to load post metadata for ${params.id}`, error);
    return buildMetadata({ title: "Post unavailable" });
  }
}

export default async function EditPostPage({ params }: PageProps) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Editor unavailable</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to load and edit posts.
        </p>
      </div>
    );
  }

  const session = await auth();
  let loadError: unknown | null = null;
  type EditablePost = Prisma.PostGetPayload<{ include: { tags: { include: { tag: true } } } }>;
  let post: EditablePost | null = null;

  try {
    post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { tags: { include: { tag: true } } },
    });
  } catch (error) {
    loadError = error;
    console.error(`Failed to load post ${params.id} for editing`, error);
  }

  if (!post) {
    if (loadError) {
      return (
        <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium">Editor unavailable</p>
          <p>We couldn&apos;t load the post. Verify your database connection and try again.</p>
        </div>
      );
    }

    notFound();
  }

  if (session?.user?.role === "writer" && post.authorId !== session.user.id) {
    notFound();
  }

  const initialPost = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? "",
    contentMdx: post.contentMdx,
    coverUrl: post.coverUrl ?? "",
    status: post.status,
    tags: post.tags.map(({ tag }) => tag.name),
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    updatedAt: post.updatedAt.toISOString(),
  } as const;

  const role = session?.user?.role ?? "writer";
  const aiEnabled = (process.env.AI_PROVIDER ?? "none").toLowerCase() !== "none";

  return <PostEditor mode="edit" initialPost={initialPost} role={role} aiEnabled={aiEnabled} />;
}
