import type { Metadata } from "next";

import { PostEditor } from "@/components/editor/Editor";
import { auth } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create post",
  description: "Draft a new blog post with autosave and MDX preview.",
});

export default async function NewPostPage() {
  const session = await auth();
  const role = session?.user?.role ?? "writer";
  const aiEnabled = (process.env.AI_PROVIDER ?? "none").toLowerCase() !== "none";
  return <PostEditor mode="create" role={role} aiEnabled={aiEnabled} />;
}
