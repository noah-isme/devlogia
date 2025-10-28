import {
  type AICompletionResult,
  type AICompletionUsage,
  type HeadlineVariantsWithUsage,
  type OutlineResult,
  type OutlineResultWithUsage,
  type RelatedPost,
  type SummaryWithUsage,
  type SeoSuggestionResult,
  type ToneAnalysis,
  type ToneAnalysisResult,
  type TonePreset,
  type WriterRequest,
} from "@/lib/ai/types";
import { slugify as normalizeSlug } from "@/lib/utils";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const HF_ENDPOINT = "https://api-inference.huggingface.co/models";

export interface AIProvider {
  writer(request: WriterRequest): Promise<AICompletionResult>;
  analyzeTone(content: string, preset?: TonePreset): Promise<ToneAnalysisResult>;
  optimizeSeo(options: {
    title: string;
    summary?: string;
    content: string;
    language?: string;
  }): Promise<SeoSuggestionResult>;
  generateOutline(options: {
    topic: string;
    summary?: string;
    tags?: string[];
    relatedPosts?: RelatedPost[];
  }): Promise<OutlineResultWithUsage>;
  generateHeadlines(options: {
    baseTitle: string;
    summary?: string;
    tags?: string[];
    count: number;
  }): Promise<HeadlineVariantsWithUsage>;
  summarize(options: {
    title: string;
    content: string;
    language?: string;
    paragraphs?: number;
    highlights?: number;
  }): Promise<SummaryWithUsage>;
}

const DEFAULT_USAGE: AICompletionUsage = {
  tokensIn: 0,
  tokensOut: 0,
  costUsd: 0,
};

function estimateUsage(prompt: string, output: string): AICompletionUsage {
  const tokensIn = Math.ceil(prompt.trim().length / 4);
  const tokensOut = Math.ceil(output.trim().length / 4);
  return {
    tokensIn,
    tokensOut,
    costUsd: Number(((tokensIn + tokensOut) * 0.000002).toFixed(6)),
  } satisfies AICompletionUsage;
}

function fleschReadingEase(text: string) {
  const sentences = Math.max(1, text.split(/[.!?]+/).filter(Boolean).length);
  const words = Math.max(1, text.split(/\s+/).filter(Boolean).length);
  const syllables = Math.max(1, text.split(/[aeiouy]+/i).length - 1);
  const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function detectTone(text: string): ToneAnalysis["tone"] {
  const lower = text.toLowerCase();
  if (/!/.test(lower) || /should|must|need to/.test(lower)) {
    return "persuasive";
  }
  if (/i\s+think|let's|you'll|we're/.test(lower)) {
    return "conversational";
  }
  return "informative";
}

function passiveSuggestions(text: string): ToneAnalysis["suggestions"] {
  const suggestions: ToneAnalysis["suggestions"] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (/\b(was|were|is|are|be|been|being)\b\s+\w+ed\b/i.test(sentence)) {
      suggestions.push({
        description: "Consider rewriting passive voice sentence in active form.",
        before: sentence.trim(),
      });
    }
    if (sentence.split(/\s+/).length > 30) {
      suggestions.push({
        description: "Split long sentence into shorter statements (≤ 30 words).",
        before: sentence.trim(),
      });
    }
  }
  return suggestions.slice(0, 8);
}

function deterministicOutline(topic: string, summary?: string, tags?: string[]): OutlineResult {
  const tagSection = tags?.length ? `\n- Focus on ${tags.join(", ")}` : "";
  const sections = [
    { heading: "Introduction", bullets: [summary ? `Why it matters: ${summary}` : "Why the topic is timely"] },
    { heading: `Core concepts of ${topic}`, bullets: ["Key definitions", "Common pitfalls"] },
    { heading: "Implementation steps", bullets: ["Plan", "Build", "Validate"] },
    { heading: "Best practices", bullets: ["Optimization", "Tooling", "Next steps"] },
  ];
  return {
    sections,
    introduction: `Set the context for ${topic}.${tagSection}`,
    conclusion: "Summarize insights and add a call-to-action.",
  } satisfies OutlineResult;
}

function deterministicHeadlines(baseTitle: string, count: number): string[] {
  const variations = [
    `${baseTitle}: A Field Guide`,
    `Inside ${baseTitle}`,
    `${baseTitle} in Practice`,
    `${baseTitle} — Lessons Learned`,
    `Why ${baseTitle} Matters Now`,
    `${baseTitle} Checklist`,
  ];
  const unique = Array.from(new Set(variations.map((item) => item.trim()).filter(Boolean)));
  return unique.slice(0, Math.max(1, Math.min(count, unique.length)));
}

function fallbackSummary(options: { title: string; content: string; paragraphs: number; highlights: number }) {
  const normalized = options.content
    .replace(/\s+/g, " ")
    .replace(/[#*_`>]/g, "")
    .trim();
  if (!normalized) {
    const summary = `${options.title}`;
    return { summary, highlights: [options.title] };
  }
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length >= 12);
  const paragraphs: string[] = [];
  const chunkSize = Math.max(1, Math.ceil(sentences.length / options.paragraphs));
  for (let index = 0; index < sentences.length && paragraphs.length < options.paragraphs; index += chunkSize) {
    const chunk = sentences.slice(index, index + chunkSize).join(" ");
    paragraphs.push(chunk.trim());
  }
  if (!paragraphs.length) {
    paragraphs.push(sentences.slice(0, Math.max(1, Math.min(sentences.length, 3))).join(" "));
  }
  const summary = paragraphs.join("\n\n");
  const highlights = paragraphs
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 12)
    .slice(0, options.highlights);
  return { summary, highlights: highlights.length ? highlights : paragraphs.slice(0, options.highlights) };
}

export class NullProvider implements AIProvider {
  async writer(request: WriterRequest): Promise<AICompletionResult> {
    const { action, title, summary, content = "", selection = "" } = request;
    let result = "";
    if (action === "draft") {
      result = `# ${title || "Untitled Draft"}\n\n${summary || "Write an engaging introduction."}\n\n## Key Takeaways\n- Point one\n- Point two\n\n## Next Steps\n- Outline implementation\n- Share insights`;
    } else if (action === "continue") {
      const last = content.split(/\n/).slice(-4).join("\n");
      result = `${last}\n\nFurther exploration:\n- Expand on the core idea\n- Provide an example\n- Close with a recommendation`;
    } else if (action.startsWith("rewrite")) {
      const target = selection || content;
      result = target.trim();
      if (action === "rewrite_concise") {
        result = target.replace(/\s+/g, " ").trim();
      } else {
        result = target.trim().replace(/\butilize\b/gi, "use");
      }
    } else if (action === "translate_en") {
      result = `[EN] ${selection || content}`;
    } else if (action === "translate_id") {
      result = `[ID] ${selection || content}`;
    }
    const usage = estimateUsage(JSON.stringify(request), result);
    return { content: result, usage } satisfies AICompletionResult;
  }

  async analyzeTone(content: string, preset?: TonePreset): Promise<ToneAnalysisResult> {
    const tone = detectTone(content);
    const readability = fleschReadingEase(content);
    const suggestions = passiveSuggestions(content);
    const adjustments = preset ? [`Align with preset: ${preset}`] : [];
    return {
      analysis: { tone, readability, suggestions, adjustments },
      usage: DEFAULT_USAGE,
    } satisfies ToneAnalysisResult;
  }

  async optimizeSeo(options: {
    title: string;
    summary?: string;
    content: string;
    language?: string;
  }): Promise<SeoSuggestionResult> {
    const slugBase = normalizeSlug(options.title) || "untitled";
    const suggestion = {
      title: options.title.slice(0, 60),
      metaDescription: (options.summary || options.content.slice(0, 150)).slice(0, 155),
      slug: slugBase.slice(0, 60),
      keywords: Array.from(
        new Set(
          (options.summary || options.content)
            .toLowerCase()
            .match(/[a-z][a-z0-9]+/g)
            ?.filter((word) => word.length > 3)
            .slice(0, 8) ?? [],
        ),
      ),
      faqs: [
        `What is ${options.title}?`,
        `How to get started with ${options.title}?`,
      ],
    };
    return {
      suggestion,
      usage: DEFAULT_USAGE,
    } satisfies SeoSuggestionResult;
  }

  async generateOutline(options: {
    topic: string;
    summary?: string;
    tags?: string[];
    relatedPosts?: RelatedPost[];
  }): Promise<OutlineResultWithUsage> {
    const outline = deterministicOutline(options.topic, options.summary, options.tags);
    if (options.relatedPosts?.length) {
      outline.sections.push({ heading: "Related reading", bullets: options.relatedPosts.map((post) => post.title) });
    }
    return { outline, usage: DEFAULT_USAGE } satisfies OutlineResultWithUsage;
  }

  async generateHeadlines(options: {
    baseTitle: string;
    summary?: string;
    tags?: string[];
    count: number;
  }): Promise<HeadlineVariantsWithUsage> {
    return {
      variants: deterministicHeadlines(options.baseTitle, options.count),
      usage: DEFAULT_USAGE,
    } satisfies HeadlineVariantsWithUsage;
  }

  async summarize(options: {
    title: string;
    content: string;
    language?: string;
    paragraphs?: number;
    highlights?: number;
  }): Promise<SummaryWithUsage> {
    const paragraphs = Math.max(1, Math.min(options.paragraphs ?? 3, 6));
    const highlightCount = Math.max(3, Math.min(options.highlights ?? 5, 8));
    const fallback = fallbackSummary({
      title: options.title,
      content: options.content,
      paragraphs,
      highlights: highlightCount,
    });
    return { summary: fallback.summary, highlights: fallback.highlights, usage: DEFAULT_USAGE, model: "null" } satisfies SummaryWithUsage;
  }
}

export class OpenAIProvider implements AIProvider {
  private readonly model: string;
  constructor(private readonly apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }
    this.model = model || process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "gpt-4o-mini";
  }

  private async request(options: {
    system?: string;
    prompt: string;
    responseFormat?: "json" | "text";
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): Promise<{ text: string; usage: AICompletionUsage; model: string }> {
    const model = options.model ?? this.model;
    const body = {
      model,
      input: options.prompt,
      system: options.system,
      temperature: options.temperature ?? Number(process.env.AI_TEMPERATURE ?? "0.6"),
      max_output_tokens: options.maxTokens ?? Number(process.env.AI_MAX_TOKENS ?? "2000"),
      response_format: options.responseFormat === "json" ? { type: "json_object" } : undefined,
    };

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Experimental-Stream-Usage": "none",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await safeText(response);
      throw new Error(`OpenAI request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number; total_cost?: number };
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.output_text || data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI response missing content");
    }
    const usage: AICompletionUsage = {
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
      costUsd: Number(data.usage?.total_cost ?? 0),
    };
    return { text: text.trim(), usage, model };
  }

  async writer(request: WriterRequest): Promise<AICompletionResult> {
    const prompt = buildWriterPrompt(request);
    const system =
      "You are an expert technical editor who writes production-ready MDX for software engineering blogs. Emphasize clarity, " +
      "actionable steps, and concise explanations. Preserve frontmatter integrity and avoid YAML headers.";
    const { text, usage } = await this.request({ prompt, system });
    return { content: text, usage } satisfies AICompletionResult;
  }

  async analyzeTone(content: string, preset?: TonePreset): Promise<ToneAnalysisResult> {
    const instructions =
      "Analyze the provided draft. Respond as JSON with keys tone (informative|conversational|persuasive), readability (number), " +
      "suggestions (array of {description,before?,after?}), and adjustments (array of strings)." +
      (preset ? ` Ensure the guidance aligns with the style preset "${preset}".` : "");
    const { text, usage } = await this.request({
      prompt: `${instructions}\n\nDraft:\n"""\n${content}\n"""`,
      responseFormat: "json",
      system: "You are a precise writing coach for engineering documentation.",
    });
    const parsed = parseToneJson(text, content, preset);
    return { analysis: parsed, usage } satisfies ToneAnalysisResult;
  }

  async optimizeSeo(options: {
    title: string;
    summary?: string;
    content: string;
    language?: string;
  }): Promise<SeoSuggestionResult> {
    const { text, usage } = await this.request({
      prompt: `Produce SEO suggestions as JSON for a blog post. Include keys: title (≤60 chars), metaDescription (≤155 chars), slug, keywords (5-8 array), faqs (5 entries).\nTitle: ${options.title}\nSummary: ${options.summary ?? ""}\nContent: ${truncate(options.content, 1200)}`,
      responseFormat: "json",
      system: "You are an SEO specialist for modern web development blogs.",
    });
    const suggestion = parseSeoJson(text, options);
    return { suggestion, usage } satisfies SeoSuggestionResult;
  }

  async generateOutline(options: {
    topic: string;
    summary?: string;
    tags?: string[];
    relatedPosts?: RelatedPost[];
  }): Promise<OutlineResultWithUsage> {
    const { text, usage } = await this.request({
      prompt: `Generate an outline as JSON with sections array, each item {heading, bullets(string[])} plus introduction and conclusion fields. Topic: ${options.topic}. Summary: ${options.summary ?? ""}. Tags: ${(options.tags ?? []).join(", ")}. Related: ${
        options.relatedPosts?.map((post) => post.title).join(", ") ?? "none"
      }.`,
      responseFormat: "json",
      system: "You produce MDX-ready outlines with H2/H3 sections and bullet notes.",
    });
    const outline = parseOutlineJson(text, options.topic, options.summary, options.tags);
    return { outline, usage } satisfies OutlineResultWithUsage;
  }

  async generateHeadlines(options: {
    baseTitle: string;
    summary?: string;
    tags?: string[];
    count: number;
  }): Promise<HeadlineVariantsWithUsage> {
    const { text, usage } = await this.request({
      prompt: `Generate ${options.count} concise headline variants for A/B testing as a JSON array of strings. Base title: ${options.baseTitle}. Summary: ${options.summary ?? ""}. Tags: ${(options.tags ?? []).join(", ")}.`,
      responseFormat: "json",
      system: "You create high-converting headlines for technical content.",
    });
    const parsed = parseHeadlineJson(text, options.count, options.baseTitle);
    return { variants: parsed, usage } satisfies HeadlineVariantsWithUsage;
  }

  async summarize(options: {
    title: string;
    content: string;
    language?: string;
    paragraphs?: number;
    highlights?: number;
  }): Promise<SummaryWithUsage> {
    const paragraphs = Math.max(1, Math.min(options.paragraphs ?? 3, 6));
    const highlightCount = Math.max(3, Math.min(options.highlights ?? 5, 8));
    const summarizerModel = process.env.AI_MODEL_SUMMARIZER?.trim() || this.model;
    const prompt = `Summarize the following article in ${paragraphs} paragraphs (separated by two newlines). ` +
      `Return JSON with keys summary (string) and highlights (array of ${highlightCount} bullet sentences).` +
      ` Focus on actionable developer insights. Article title: ${options.title}. Language: ${options.language ?? "en"}.` +
      ` Article body:\n"""\n${truncate(options.content, 6000)}\n"""`;
    try {
      const { text, usage, model } = await this.request({
        prompt,
        responseFormat: "json",
        temperature: 0.2,
        maxTokens: 900,
        model: summarizerModel,
      });
      const parsed = JSON.parse(text) as Partial<{ summary: string; highlights: string[] }>;
      const fallback = fallbackSummary({
        title: options.title,
        content: options.content,
        paragraphs,
        highlights: highlightCount,
      });
      const summary = parsed.summary?.trim()?.replace(/\n{3,}/g, "\n\n") || fallback.summary;
      const highlights = Array.isArray(parsed.highlights)
        ? parsed.highlights.map((item) => String(item).trim()).filter(Boolean).slice(0, highlightCount)
        : fallback.highlights;
      return {
        summary,
        highlights: highlights.length ? highlights : fallback.highlights,
        usage,
        model,
      } satisfies SummaryWithUsage;
    } catch (error) {
      console.warn("OpenAI summary request failed", error);
      const fallback = fallbackSummary({
        title: options.title,
        content: options.content,
        paragraphs,
        highlights: highlightCount,
      });
      return { summary: fallback.summary, highlights: fallback.highlights, usage: DEFAULT_USAGE, model: summarizerModel } satisfies SummaryWithUsage;
    }
  }
}

export class HFProvider implements AIProvider {
  private readonly model: string;
  constructor(private readonly apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error("Missing HF_API_KEY");
    }
    this.model = model || process.env.AI_MODEL_WRITER || process.env.AI_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
  }

  private async request(prompt: string): Promise<string> {
    const response = await fetch(`${HF_ENDPOINT}/${this.model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const message = await safeText(response);
      throw new Error(`HF request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as Array<{ generated_text?: string }> | { generated_text?: string };
    const text = Array.isArray(data)
      ? data[0]?.generated_text
      : (data as { generated_text?: string }).generated_text;
    if (!text) {
      throw new Error("HF response missing content");
    }
    return text.trim();
  }

  async writer(request: WriterRequest): Promise<AICompletionResult> {
    const prompt = buildWriterPrompt(request);
    const text = await this.request(prompt);
    return { content: text, usage: estimateUsage(prompt, text) } satisfies AICompletionResult;
  }

  async analyzeTone(content: string, preset?: TonePreset): Promise<ToneAnalysisResult> {
    const prompt =
      `Assess tone (informative|conversational|persuasive), readability (0-100), suggestions (list) and adjustments for preset ${
        preset ?? "none"
      }. Return JSON.\n\n${content}`;
    const text = await this.request(prompt);
    const analysis = parseToneJson(text, content, preset);
    return { analysis, usage: estimateUsage(prompt, text) } satisfies ToneAnalysisResult;
  }

  async optimizeSeo(options: {
    title: string;
    summary?: string;
    content: string;
    language?: string;
  }): Promise<SeoSuggestionResult> {
    const prompt =
      `Suggest SEO metadata as JSON with title, metaDescription, slug, keywords(5-8), faqs(5). Title: ${options.title}. Summary: ${
        options.summary ?? ""
      }. Content: ${truncate(options.content, 1000)}.`;
    const text = await this.request(prompt);
    const suggestion = parseSeoJson(text, options);
    return { suggestion, usage: estimateUsage(prompt, text) } satisfies SeoSuggestionResult;
  }

  async generateOutline(options: {
    topic: string;
    summary?: string;
    tags?: string[];
    relatedPosts?: RelatedPost[];
  }): Promise<OutlineResultWithUsage> {
    const prompt =
      `Create MDX outline JSON with sections[{heading,bullets[]}], introduction, conclusion. Topic: ${options.topic}. Summary: ${
        options.summary ?? ""
      }. Tags: ${(options.tags ?? []).join(", ")}. Related: ${
        options.relatedPosts?.map((post) => post.title).join(", ") ?? "none"
      }.`;
    const text = await this.request(prompt);
    const outline = parseOutlineJson(text, options.topic, options.summary, options.tags);
    return { outline, usage: estimateUsage(prompt, text) } satisfies OutlineResultWithUsage;
  }

  async generateHeadlines(options: {
    baseTitle: string;
    summary?: string;
    tags?: string[];
    count: number;
  }): Promise<HeadlineVariantsWithUsage> {
    const prompt =
      `Produce ${options.count} alternative headlines as JSON array for base title "${options.baseTitle}". Summary: ${
        options.summary ?? ""
      }. Tags: ${(options.tags ?? []).join(", ")}.`;
    const text = await this.request(prompt);
    const variants = parseHeadlineJson(text, options.count, options.baseTitle);
    return { variants, usage: estimateUsage(prompt, text) } satisfies HeadlineVariantsWithUsage;
  }

  async summarize(options: {
    title: string;
    content: string;
    language?: string;
    paragraphs?: number;
    highlights?: number;
  }): Promise<SummaryWithUsage> {
    const paragraphs = Math.max(1, Math.min(options.paragraphs ?? 3, 6));
    const highlightCount = Math.max(3, Math.min(options.highlights ?? 5, 8));
    const fallback = fallbackSummary({
      title: options.title,
      content: options.content,
      paragraphs,
      highlights: highlightCount,
    });
    const prompt =
      `Summarize the article "${options.title}" in ${paragraphs} paragraphs separated by blank lines, ` +
      `followed by a section starting with 'Highlights:' containing ${highlightCount} bullet lines.\n\n${truncate(options.content, 4000)}`;
    try {
      const text = await this.request(prompt);
      const usage = estimateUsage(prompt, text);
      const [summaryPart, highlightPartRaw] = text.split(/Highlights:/i);
      const summary = summaryPart?.trim().replace(/\n{3,}/g, "\n\n") || fallback.summary;
      const highlightPart = highlightPartRaw?.trim() ?? "";
      const highlights = highlightPart
        .split(/\n|•|-/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 8)
        .slice(0, highlightCount);
      return {
        summary,
        highlights: highlights.length ? highlights : fallback.highlights,
        usage,
        model: this.model,
      } satisfies SummaryWithUsage;
    } catch (error) {
      console.warn("HF summary request failed", error);
      return { summary: fallback.summary, highlights: fallback.highlights, usage: DEFAULT_USAGE, model: this.model } satisfies SummaryWithUsage;
    }
  }
}

let cachedProvider: AIProvider | null = null;

export function resolveAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider;
  }
  const provider = (process.env.AI_PROVIDER || "none").toLowerCase();
  try {
    if (provider === "openai") {
      const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
      cachedProvider = new OpenAIProvider(apiKey);
    } else if (provider === "hf") {
      const apiKey = process.env.HF_API_KEY || process.env.AI_API_KEY || "";
      cachedProvider = new HFProvider(apiKey);
    } else {
      cachedProvider = new NullProvider();
    }
  } catch (error) {
    console.error("Failed to initialize AI provider", error);
    cachedProvider = new NullProvider();
  }
  return cachedProvider;
}

export function resetAIProvider() {
  cachedProvider = null;
}

function parseToneJson(text: string, fallback: string, preset?: TonePreset): ToneAnalysis {
  try {
    const parsed = JSON.parse(text) as Partial<ToneAnalysis>;
    if (parsed && typeof parsed === "object") {
      return {
        tone: (parsed.tone as ToneAnalysis["tone"]) ?? detectTone(fallback),
        readability: typeof parsed.readability === "number" ? Math.round(parsed.readability) : fleschReadingEase(fallback),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map((item) => ({
              description: String((item as { description?: string }).description ?? "Refine sentence"),
              before: (item as { before?: string }).before,
              after: (item as { after?: string }).after,
            }))
          : passiveSuggestions(fallback),
        adjustments: Array.isArray(parsed.adjustments)
          ? parsed.adjustments.map((entry) => String(entry))
          : preset
            ? [`Align with preset: ${preset}`]
            : [],
      } satisfies ToneAnalysis;
    }
  } catch (error) {
    console.error("Failed to parse tone analysis JSON", error);
  }
  return {
    tone: detectTone(fallback),
    readability: fleschReadingEase(fallback),
    suggestions: passiveSuggestions(fallback),
    adjustments: preset ? [`Align with preset: ${preset}`] : [],
  } satisfies ToneAnalysis;
}

function parseSeoJson(
  text: string,
  options: { title: string; summary?: string; content: string; language?: string },
) {
  try {
    const parsed = JSON.parse(text) as Partial<{ title: string; metaDescription: string; slug: string; keywords: string[]; faqs: string[] }>;
    if (parsed && typeof parsed === "object") {
      return {
        title: (parsed.title ?? options.title).slice(0, 60),
        metaDescription: (parsed.metaDescription ?? options.summary ?? truncate(options.content, 155)).slice(0, 155),
        slug: (parsed.slug ?? normalizeSlug(options.title)).slice(0, 60),
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.map((item) => String(item)).filter(Boolean).slice(0, 8)
          : buildFallbackKeywords(options.content),
        faqs: Array.isArray(parsed.faqs)
          ? parsed.faqs.map((item) => String(item)).filter(Boolean).slice(0, 8)
          : [
              `What is ${options.title}?`,
              `How does ${options.title} help developers?`,
            ],
      };
    }
  } catch (error) {
    console.error("Failed to parse SEO JSON", error);
  }
  return {
    title: options.title.slice(0, 60),
    metaDescription: (options.summary ?? truncate(options.content, 155)).slice(0, 155),
    slug: normalizeSlug(options.title).slice(0, 60),
    keywords: buildFallbackKeywords(options.content),
    faqs: [
      `What is ${options.title}?`,
      `How does ${options.title} help developers?`,
    ],
  };
}

function parseOutlineJson(text: string, topic: string, summary?: string, tags?: string[]): OutlineResult {
  try {
    const parsed = JSON.parse(text) as Partial<OutlineResult>;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.sections)) {
      return {
        sections: parsed.sections.map((section) => ({
          heading: String((section as { heading?: string }).heading ?? "Section"),
          bullets: Array.isArray((section as { bullets?: string[] }).bullets)
            ? (section as { bullets?: string[] }).bullets!.map((bullet) => String(bullet))
            : [],
        })),
        introduction: parsed.introduction ?? summary ?? `Introduce ${topic}`,
        conclusion: parsed.conclusion ?? "Summarize learnings and next actions.",
      } satisfies OutlineResult;
    }
  } catch (error) {
    console.error("Failed to parse outline JSON", error);
  }
  return deterministicOutline(topic, summary, tags);
}

function parseHeadlineJson(text: string, count: number, base: string): string[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const variants = parsed.map((item) => String(item).trim()).filter(Boolean);
      if (variants.length) {
        return variants.slice(0, count);
      }
    }
  } catch (error) {
    console.error("Failed to parse headline JSON", error);
  }
  return deterministicHeadlines(base, count);
}

function buildWriterPrompt(request: WriterRequest) {
  const languageLabel = request.targetLanguage === "id" ? "Indonesian" : request.targetLanguage === "en" ? "English" : "Original";
  const actionMap: Record<WriterRequest["action"], string> = {
    draft: "Create a full MDX draft with headings, code blocks when relevant, and callouts.",
    continue: "Continue the draft seamlessly without repeating earlier sections. Provide 2-3 new paragraphs and optional list.",
    rewrite_clarity: "Rewrite the selection to improve clarity while preserving meaning.",
    rewrite_concise: "Rewrite the selection to be more concise (≤20% shorter).",
    translate_en: "Translate the selection into English while keeping markdown/MDX syntax intact.",
    translate_id: "Translate the selection into Indonesian while keeping markdown/MDX syntax intact.",
  };
  const base = [`# Task`, actionMap[request.action]];
  base.push(`
# Context
- Title: ${request.title || "Untitled"}`);
  if (request.summary) base.push(`- Summary: ${request.summary}`);
  if (request.tags?.length) base.push(`- Tags: ${request.tags.join(", ")}`);
  if (request.toneGuide) base.push(`- Tone guide: ${request.toneGuide}`);
  if (request.styleGuide) base.push(`- Style guide: ${request.styleGuide}`);
  if (request.relatedPosts?.length) {
    base.push(`- Related posts: ${request.relatedPosts.map((post) => post.title).join(", ")}`);
  }
  base.push(`- Target language: ${languageLabel}`);
  base.push(`
# Existing content
${truncate(request.content ?? "", 2000) || "(none)"}`);
  if (request.selection) {
    base.push(`
# Selection
${request.selection}`);
  }
  base.push(`
# Requirements
- Maintain valid MDX. Preserve code blocks and callouts.
- Avoid modifying YAML frontmatter.
- Stream-ready response (no superfluous commentary).`);
  return base.join("\n");
}

function buildFallbackKeywords(content: string) {
  return Array.from(
    new Set(
      (content.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? [])
        .filter((word) => word.length > 3)
        .slice(0, 8),
    ),
  );
}

function truncate(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, maxLength)}…`;
}

async function safeText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
