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

  it("null provider exposes deterministic fallbacks", async () => {
    const provider = new NullProvider();
    const draft = await provider.writer({ action: "draft", title: "Next.js performance", summary: "Improve builds" });
    expect(draft.content).toContain("# Next.js performance");

    const tone = await provider.analyzeTone("This is a simple informative sentence.");
    expect(tone.analysis.tone).toBe("informative");
    expect(typeof tone.analysis.readability).toBe("number");

    const seo = await provider.optimizeSeo({ title: "Next.js performance", content: "Optimize Next.js builds" });
    expect(seo.suggestion.slug).toContain("nextjs-performance");
  });
});
