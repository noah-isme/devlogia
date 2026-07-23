export type ReadingTimeResult = {
  minutes: number;
  text: string;
  words: number;
};

export function calculateReadingTime(content: string, wpm = 200): ReadingTimeResult {
  if (!content) {
    return { minutes: 1, text: "1 min read", words: 0 };
  }

  // Strip MDX / HTML code tags and formatting
  const plainText = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[#*_-]/g, " ")
    .trim();

  const words = plainText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / wpm));

  return {
    minutes,
    text: `${minutes} min read`,
    words,
  };
}
