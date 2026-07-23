import { describe, expect, it } from "vitest";

import { calculateAudioMetadata, cleanMdxForSpeech } from "@/lib/tts/cleaner";

describe("Text-to-Speech (TTS) Narration Engine", () => {
  it("cleans code blocks, JSX tags, and markdown markup for speech", () => {
    const rawMdx = `
# Getting Started with React

Here is how you write a component in **React**:

\`\`\`tsx
export function MyButton() {
  return <button>Click me</button>;
}
\`\`\`

Check out [React Documentation](https://react.dev) for more details.

<Callout variant="warning">Important Note!</Callout>
`;

    const cleaned = cleanMdxForSpeech(rawMdx);

    expect(cleaned).toContain("Code snippet omitted for audio narration.");
    expect(cleaned).not.toContain("export function MyButton");
    expect(cleaned).not.toContain("<Callout");
    expect(cleaned).not.toContain("https://react.dev");
    expect(cleaned).toContain("React Documentation");
    expect(cleaned).toContain("Section: Getting Started with React.");
  });

  it("calculates accurate duration and chapters from post content", () => {
    const title = "Understanding Async JavaScript";
    const mdx = `
## Introduction
Async programming allows non-blocking execution.

## Promises and Async/Await
Promises represent eventual values.
`;

    const metadata = calculateAudioMetadata(title, mdx);

    expect(metadata.title).toBe(title);
    expect(metadata.wordCount).toBeGreaterThan(5);
    expect(metadata.estimatedDurationSeconds).toBeGreaterThan(0);
    expect(metadata.chapters.length).toBeGreaterThanOrEqual(2);
    expect(metadata.chapters[0].title).toBe("Introduction");
  });
});
