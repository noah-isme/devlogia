import { describe, expect, it } from "vitest";

import { estimateReadingTime, formatDate, slugify } from "@/lib/utils";

describe("utils", () => {
  it("slugify normalizes strings", () => {
    expect(slugify("Hello World!"))
      .toBe("hello-world");
  });

  it("formatDate formats ISO date", () => {
    const formatted = formatDate("2024-01-01T00:00:00.000Z", "en-US");
    expect(formatted).toMatch(/2024/);
  });

  it("estimateReadingTime returns a human string", () => {
    const reading = estimateReadingTime("word ".repeat(300));
    expect(reading).toContain("min read");
  });
});
