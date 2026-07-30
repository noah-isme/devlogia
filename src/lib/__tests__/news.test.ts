import { afterEach, describe, expect, test } from "vitest";

import { signResearchSources, verifyResearchSources } from "@/lib/news";

const source = {
  title: "Current event",
  description: "A dated provider excerpt.",
  publisher: "Example News",
  publishedAt: "2026-07-30T00:00:00.000Z",
  url: "https://news.example/current-event",
};

describe("signed news research", () => {
  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  test("permits only selected sources from a signed research result", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    const token = signResearchSources([source]);

    expect(verifyResearchSources(token, [source.url])).toEqual([source]);
    expect(verifyResearchSources(token, ["https://untrusted.example/story"])).toBeNull();
  });
});
