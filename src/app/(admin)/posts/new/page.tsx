import type { Metadata } from "next";

import { PostEditor } from "@/components/editor/Editor";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Create post",
  description: "Draft a new blog post with autosave and MDX preview.",
});

export default function NewPostPage() {
  return <PostEditor mode="create" />;
}
