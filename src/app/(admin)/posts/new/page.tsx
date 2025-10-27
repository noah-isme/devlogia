import { Suspense } from "react";
import type { Metadata } from "next";

import { PostEditor } from "@/components/editor/Editor";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

function EditorFallback() {
  return (
    <main
      aria-busy="true"
      className="space-y-6"
      data-testid="post-editor"
    >
      <div className="space-y-3">
        <div
          aria-hidden
          className="h-6 w-48 rounded bg-muted animate-pulse"
          data-testid="post-editor-heading"
        />
        <div className="h-10 w-full rounded bg-muted/70 animate-pulse" data-testid="post-title" />
      </div>
      <div className="h-64 w-full rounded border border-dashed border-border bg-muted/40" />
    </main>
  );
}

export const metadata: Metadata = buildMetadata({
  title: "Create post",
  description: "Draft a new blog post with autosave and MDX preview.",
});

export default async function NewPostPage() {
  const session = await auth();
  const role = session?.user?.role ?? "writer";
  const aiEnabled = (process.env.AI_PROVIDER ?? "none").toLowerCase() !== "none";

  return (
    <Suspense fallback={<EditorFallback />}>
      <PostEditor mode="create" role={role} aiEnabled={aiEnabled} />
    </Suspense>
  );
}
