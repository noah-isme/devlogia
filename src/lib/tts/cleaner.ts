export type SpeechChapter = {
  id: string;
  title: string;
  text: string;
};

export type AudioNarrationMetadata = {
  title: string;
  cleanText: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  chapters: SpeechChapter[];
};

/**
 * Cleans MDX/Markdown text into smooth, natural spoken prose suitable for TTS engines.
 * Strips code blocks, JSX tags, link URLs, raw markdown markup, and normalizes punctuation pauses.
 */
export function cleanMdxForSpeech(mdx: string): string {
  if (!mdx) return "";

  let text = mdx;

  // 1. Remove code blocks ```...``` (replace with spoken announcement)
  text = text.replace(/```[\s\S]*?```/g, ". Code snippet omitted for audio narration. ");

  // 2. Remove inline code backticks `code`
  text = text.replace(/`([^`]+)`/g, "$1");

  // 3. Remove JSX/MDX tags <Callout...>...</Callout> or <Component />
  text = text.replace(/<[^>]+>/g, " ");

  // 4. Convert markdown headings (# Heading) to natural section announcements
  text = text.replace(/^#{1,6}\s+(.+)$/gm, ". Section: $1. ");

  // 5. Remove markdown image syntax ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, " Image: $1. ");

  // 6. Convert markdown links [link text](url) to just link text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 7. Remove markdown emphasis (*bold*, _italic_, **strong**)
  text = text.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");

  // 8. Clean up bullet lists and blockquotes
  text = text.replace(/^[*\-+]\s+/gm, "");
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");

  // 9. Normalize multiple newlines, spaces, and punctuation
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\s+([.,!?;:])/g, "$1");
  text = text.replace(/(\. ){2,}/g, ". ");

  return text.trim();
}

/**
 * Generates structured audio chapters and calculates listening duration.
 */
export function calculateAudioMetadata(title: string, mdx: string): AudioNarrationMetadata {
  const cleanText = cleanMdxForSpeech(mdx);
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Average reading rate for spoken text is ~150 words per minute
  const estimatedDurationSeconds = Math.max(10, Math.round((wordCount / 150) * 60));

  // Extract chapters from headings
  const chapterMatches = Array.from(mdx.matchAll(/^#{1,3}\s+(.+)$/gm));
  const chapters: SpeechChapter[] = [
    {
      id: "intro",
      title: "Introduction",
      text: `${title}. ${cleanText.slice(0, 300)}...`,
    },
  ];

  chapterMatches.forEach((match, index) => {
    const headingTitle = match[1].trim();
    chapters.push({
      id: `chapter-${index + 1}`,
      title: headingTitle,
      text: headingTitle,
    });
  });

  return {
    title,
    cleanText: `${title}. ${cleanText}`,
    wordCount,
    estimatedDurationSeconds,
    chapters,
  };
}
