import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommentsManager, type AdminCommentItem } from "@/components/admin/CommentsManager";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Comments Moderation",
  description: "Review, approve, and moderate reader comments.",
});

export default async function CommentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  const prismaModule = await import("@/lib/prisma");
  const { isDatabaseEnabled, prisma } = prismaModule;

  if (!isDatabaseEnabled) {
    return (
      <div className="space-y-6 rounded-md border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        <p className="font-medium">Comments unavailable</p>
        <p>
          Configure the <code>DATABASE_URL</code> environment variable to review comments.
        </p>
      </div>
    );
  }

  let initialComments: AdminCommentItem[] = [];

  try {
    const rawComments = await prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        postId: true,
        parentId: true,
        authorName: true,
        authorEmail: true,
        content: true,
        status: true,
        createdAt: true,
        post: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });

    initialComments = rawComments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Failed to load comments for moderation", error);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Comments Moderation</h1>
        <p className="text-sm text-muted-foreground">
          Review reader comments across your articles. Approve legitimate feedback or flag spam.
        </p>
      </header>
      <CommentsManager initialComments={initialComments} />
    </div>
  );
}
