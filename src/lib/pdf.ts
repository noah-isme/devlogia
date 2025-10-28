function sanitizeText(text: string) {
  return text.replace(/[\r\t]/g, " ").replace(/ +/g, " ").trim();
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .replace(/^#+\s*(.*)$/gm, "$1")
    .replace(/^>\s?(.*)$/gm, "$1")
    .replace(/^-\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n");
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdfObjects(contentStream: string) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    const id = objects.length + 1;
    objects.push(`${id} 0 obj\n${body}\nendobj\n`);
    return id;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const streamBuffer = Buffer.from(contentStream, "utf8");
  const contentId = addObject(`<< /Length ${streamBuffer.length} >>\nstream\n${contentStream}\nendstream`);
  const pageId = addObject(
    `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
  );
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`);
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return { objects, catalogId };
}

export function renderPdfFromMarkdown(markdown: string) {
  const text = sanitizeText(markdownToPlainText(markdown));
  const lines = text.split(/\n/);
  const commands = ["BT", "/F1 12 Tf", "72 760 Td"];
  let currentY = 760;

  for (const line of lines) {
    if (!line.trim()) {
      currentY -= 18;
      commands.push("0 -18 Td");
      continue;
    }
    if (currentY < 72) {
      commands.push("ET BT", "72 760 Td");
      currentY = 760;
    }
    const safe = escapePdfText(line.trim());
    commands.push(`(${safe}) Tj`, "0 -18 Td");
    currentY -= 18;
  }
  commands.push("ET");

  const contentStream = commands.join("\n");
  const { objects, catalogId } = buildPdfObjects(contentStream);
  const header = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f \n"];
  let body = "";
  let position = header.length;

  for (const object of objects) {
    body += object;
    offsets.push(`${position.toString().padStart(10, "0")} 00000 n \n`);
    position += Buffer.byteLength(object, "utf8");
  }

  const xref = `xref\n0 ${objects.length + 1}\n${offsets.join("")}`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${position}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "utf8");
}

export function markdownToReportBuffer(markdown: string, format: "markdown" | "pdf" = "markdown") {
  if (format === "pdf") {
    return { buffer: renderPdfFromMarkdown(markdown), contentType: "application/pdf" } as const;
  }
  return { buffer: Buffer.from(markdown, "utf8"), contentType: "text/markdown" } as const;
}
