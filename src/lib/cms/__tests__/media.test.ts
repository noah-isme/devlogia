import { describe, expect, test } from "vitest";

import { isMediaUsedByContent } from "@/lib/cms/media";

describe("media usage detection", () => {
  test("detects media reused in post covers, post content, and page content", () => {
    const asset = { publicUrl: "/uploads/cover.png", path: "uploads/2026/cover.png" };

    expect(isMediaUsedByContent(asset, { postCoverUrls: ["/uploads/cover.png"], postBodies: [], pageBodies: [] })).toBe(true);
    expect(isMediaUsedByContent(asset, { postCoverUrls: [], postBodies: ["![cover](/uploads/cover.png)"], pageBodies: [] })).toBe(true);
    expect(isMediaUsedByContent(asset, { postCoverUrls: [], postBodies: [], pageBodies: ["uploads/2026/cover.png"] })).toBe(true);
    expect(isMediaUsedByContent(asset, { postCoverUrls: [], postBodies: ["no match"], pageBodies: [] })).toBe(false);
  });
});
