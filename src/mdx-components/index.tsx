import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { Callout } from "@/mdx-components/callout";
import { InlineCode, Pre } from "@/mdx-components/code";

export const mdxComponents: MDXRemoteProps["components"] = {
  pre: Pre,
  code: InlineCode,
  Callout,
};
