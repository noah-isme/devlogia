import { describe, expect, it } from "vitest";

import {
  preserveMdxElements,
  restoreMdxElements,
  translateMdxDocument,
} from "@/lib/ai/mdx-translator";

describe("MDX Translation Pipeline", () => {
  it("preserves code blocks and inline code during token replacement", () => {
    const sampleMdx = `
# Hello World

Here is an explanation of TypeScript code:

\`\`\`ts
function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

You can also use \`const x = 10\` in inline code.

<Callout type="info">This is an MDX callout component</Callout>
`;

    const { textWithPlaceholders, placeholders } = preserveMdxElements(sampleMdx);

    expect(textWithPlaceholders).toContain("__MDX_CODE_BLOCK_0__");
    expect(textWithPlaceholders).toContain("__INLINE_CODE_0__");
    expect(textWithPlaceholders).toContain("__MDX_COMPONENT_0__");
    expect(textWithPlaceholders).not.toContain("function add");

    const restored = restoreMdxElements(textWithPlaceholders, placeholders);
    expect(restored).toBe(sampleMdx);
  });

  it("translates document to Spanish while preserving code blocks", async () => {
    const sampleMdx = `
# Introduction to Next.js

Next.js is a powerful framework.

\`\`\`js
console.log("Hello Next.js");
\`\`\`
`;

    const result = await translateMdxDocument({
      title: "Introduction to Next.js",
      summary: "A quick guide to Next.js",
      contentMdx: sampleMdx,
      targetLanguage: "es",
    });

    expect(result.targetLanguage).toBe("es");
    expect(result.languageName).toBe("Spanish");
    expect(result.contentMdx).toContain('console.log("Hello Next.js");');
  });

  it("supports Indonesian translation", async () => {
    const sampleMdx = "This is a test post about architecture.";
    const result = await translateMdxDocument({
      title: "Architecture Guide",
      summary: "System design basics",
      contentMdx: sampleMdx,
      targetLanguage: "id",
    });

    expect(result.targetLanguage).toBe("id");
    expect(result.languageName).toBe("Indonesian");
    expect(result.title).toBeDefined();
  });
});
