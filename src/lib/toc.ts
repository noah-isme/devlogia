export type TocHeading = {
  id: string;
  text: string;
  level: number;
};

export function extractHeadings(contentMdx: string): TocHeading[] {
  if (!contentMdx) return [];

  const lines = contentMdx.split("\n");
  const headings: TocHeading[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].replace(/[*_~`]/g, "").trim();
      const id = rawText
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

      if (id && rawText) {
        headings.push({ id, text: rawText, level });
      }
    }
  }

  return headings;
}
