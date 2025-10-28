import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { Callout } from "@/mdx-components/Callout";
import { InlineCode, Pre } from "@/mdx-components/code";

export const mdxComponents: MDXRemoteProps["components"] = {
  pre: Pre,
  code: InlineCode,
  Callout,
};

type MdxComponentMap = NonNullable<MDXRemoteProps["components"]>;

export function useMDXComponents(components: MdxComponentMap = {}): MdxComponentMap {
  return {
    ...mdxComponents,
    ...components,
  };
}
