import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NullProvider, resetAIProvider, resolveAIProvider } from "@/lib/ai/provider";

describe("AI providers", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "none";
    resetAIProvider();
  });

  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("returns the null provider when disabled", () => {
    const provider = resolveAIProvider();
    expect(provider).toBeInstanceOf(NullProvider);
  });

  it("null provider generates deterministic helpers", async () => {
    const provider = new NullProvider();
    const outline = await provider.suggestOutline("Next.js performance");
    expect(outline).toEqual([
      "Next.js performance",
      "Next.js performance insights",
      "Next steps for Next.js performance",
    ]);

    const meta = await provider.suggestMeta("Test title", "Content for testing meta description.");
    expect(meta.title).toBe("Test title");
    expect(meta.description.length).toBeGreaterThan(0);

    const tags = await provider.suggestTags("TypeScript TypeScript Next.js testing strategy", 3);
    expect(tags).toContain("typescript");

    const rephrased = await provider.rephrase("  Hello world  ");
    expect(rephrased).toBe("Hello world");
  });
});
