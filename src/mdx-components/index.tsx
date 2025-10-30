import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { Callout } from "@/mdx-components/Callout";
import { InlineCode, Pre } from "@/mdx-components/code";
import { CodeSnippet } from "@/components/devportal/CodeSnippet";

export const mdxComponents: MDXRemoteProps["components"] = {
  pre: Pre,
  code: InlineCode,
  Callout,
  CodeSnippet,
};

type MdxComponentMap = NonNullable<MDXRemoteProps["components"]>;

export function useMDXComponents(components: MdxComponentMap = {}): MdxComponentMap {
  return {
    ...mdxComponents,
    ...components,
  };
}
