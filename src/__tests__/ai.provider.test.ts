import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NullProvider, resetAIProvider, resolveAIProvider } from "@/lib/ai/provider";

describe("AI providers", () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = "none";
    resetAIProvider();
  });

  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    delete process.env.GROQ_BASE_URL;
    resetAIProvider();
    vi.unstubAllGlobals();
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

  it("uses Groq's OpenAI-compatible chat-completions format", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "## Summary\nReady for review." } }],
          usage: { prompt_tokens: 11, completion_tokens: 7 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "groq-key";
    resetAIProvider();
    const provider = resolveAIProvider();

    const result = await provider.writer({
      action: "editorial_review",
      title: "Reliable jobs",
      content: "Use idempotent workers and observable retries.",
    });

    expect(result).toMatchObject({ content: "## Summary\nReady for review.", usage: { tokensIn: 11, tokensOut: 7 } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer groq-key" }),
        body: expect.stringContaining('"messages"'),
      }),
    );
  });
});
