import { resolveAIProvider } from "@/lib/ai/provider";
import type { AICompletionUsage } from "@/lib/ai/types";

export type SupportedLanguageCode = "id" | "es" | "fr" | "de" | "ja" | "en" | "zh";

export type SupportedLanguage = {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "en", name: "English", nativeName: "English" },
];

export type PreserveResult = {
  textWithPlaceholders: string;
  placeholders: Map<string, string>;
};

/**
 * Replaces code blocks, inline code, and MDX/JSX components with unique placeholders
 * to ensure AI translation never alters code logic, syntax, or component tags.
 */
export function preserveMdxElements(mdx: string): PreserveResult {
  const placeholders = new Map<string, string>();
  let codeCounter = 0;
  let componentCounter = 0;
  let inlineCounter = 0;

  // 1. Preserve triple-backtick (or multi-backtick) code blocks
  let result = mdx.replace(/```[\s\S]*?```/g, (match) => {
    const key = `__MDX_CODE_BLOCK_${codeCounter++}__`;
    placeholders.set(key, match);
    return key;
  });

  // 2. Preserve self-closing or paired JSX/MDX component tags (e.g., <Callout .../> or <Component>...</Component>)
  result = result.replace(/<([A-Z][A-Za-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>|<([A-Z][A-Za-z0-9]*)\b[^>]*\/>/g, (match) => {
    const key = `__MDX_COMPONENT_${componentCounter++}__`;
    placeholders.set(key, match);
    return key;
  });

  // 3. Preserve inline code backticks `code`
  result = result.replace(/`[^`\n]+`/g, (match) => {
    const key = `__INLINE_CODE_${inlineCounter++}__`;
    placeholders.set(key, match);
    return key;
  });

  return {
    textWithPlaceholders: result,
    placeholders,
  };
}

/**
 * Restores all preserved code blocks and MDX components back to the translated text.
 */
export function restoreMdxElements(translatedText: string, placeholders: Map<string, string>): string {
  let restored = translatedText;
  for (const [key, original] of placeholders.entries()) {
    // Replace exact key or slightly altered whitespace version of key
    const safeRegex = new RegExp(key.replace(/_/g, "_+"), "g");
    restored = restored.replace(safeRegex, original);
  }
  return restored;
}

export type TranslateMdxOptions = {
  title: string;
  summary?: string;
  contentMdx: string;
  targetLanguage: SupportedLanguageCode;
  sourceLanguage?: string;
};

export type TranslateMdxResult = {
  title: string;
  summary: string;
  contentMdx: string;
  targetLanguage: SupportedLanguageCode;
  languageName: string;
  usage: AICompletionUsage;
};

/**
 * High-level translation pipeline that preserves MDX code & components while auto-translating.
 */
export async function translateMdxDocument(options: TranslateMdxOptions): Promise<TranslateMdxResult> {
  const { title, summary = "", contentMdx, targetLanguage } = options;
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) || {
    code: targetLanguage,
    name: targetLanguage.toUpperCase(),
    nativeName: targetLanguage.toUpperCase(),
  };

  const { textWithPlaceholders, placeholders } = preserveMdxElements(contentMdx);

  const provider = resolveAIProvider();

  // Prompt the AI provider with strict MDX preservation instructions
  const prompt = [
    `# Task`,
    `Translate the following blog post title, summary, and MDX content into ${langConfig.name} (${langConfig.nativeName}).`,
    ``,
    `# Rules`,
    `1. DO NOT translate or modify any placeholder tokens starting with __MDX_CODE_BLOCK_, __MDX_COMPONENT_, or __INLINE_CODE_. Keep them EXACTLY as they appear.`,
    `2. Keep MDX headers (#, ##, ###), lists, blockquotes, and formatting structure intact.`,
    `3. Respond ONLY with valid JSON using keys: "title" (translated title), "summary" (translated summary), and "contentMdx" (translated content with placeholders preserved).`,
    ``,
    `# Original Title`,
    title,
    ``,
    `# Original Summary`,
    summary || "(none)",
    ``,
    `# Original MDX Body`,
    textWithPlaceholders,
  ].join("\n");

  let translatedTitle = title;
  let translatedSummary = summary;
  let translatedContentWithPlaceholders = textWithPlaceholders;
  let usage: AICompletionUsage = { tokensIn: 0, tokensOut: 0, costUsd: 0 };

  try {
    const res = await provider.writer({
      action: targetLanguage === "id" ? "translate_id" : "translate_en",
      title,
      summary,
      content: textWithPlaceholders,
      targetLanguage: targetLanguage === "id" ? "id" : "en",
      styleGuide: prompt,
    });

    usage = res.usage;

    // Try parsing JSON output if available, or fall back to extracting structure
    try {
      const parsed = JSON.parse(res.content) as Partial<{ title: string; summary: string; contentMdx: string }>;
      if (parsed.title) translatedTitle = parsed.title;
      if (parsed.summary !== undefined) translatedSummary = parsed.summary;
      if (parsed.contentMdx) translatedContentWithPlaceholders = parsed.contentMdx;
    } catch {
      // If raw text was returned instead of JSON
      if (res.content.trim()) {
        translatedContentWithPlaceholders = res.content.trim();
        // Fallback title prefix if null provider
        if (title) {
          translatedTitle = `[${langConfig.code.toUpperCase()}] ${title}`;
        }
        if (summary) {
          translatedSummary = `[${langConfig.code.toUpperCase()}] ${summary}`;
        }
      }
    }
  } catch (error) {
    console.error("AI MDX translation failed, using fallback translation", error);
    translatedTitle = `[${langConfig.code.toUpperCase()}] ${title}`;
    translatedSummary = summary ? `[${langConfig.code.toUpperCase()}] ${summary}` : "";
    translatedContentWithPlaceholders = `[${langConfig.code.toUpperCase()}] ${textWithPlaceholders}`;
  }

  // Restore preserved code blocks and MDX components
  const restoredContentMdx = restoreMdxElements(translatedContentWithPlaceholders, placeholders);

  return {
    title: translatedTitle,
    summary: translatedSummary,
    contentMdx: restoredContentMdx,
    targetLanguage,
    languageName: langConfig.name,
    usage,
  };
}
