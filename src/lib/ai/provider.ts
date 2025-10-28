const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const HF_ENDPOINT = "https://api-inference.huggingface.co/models";

export interface AIProvider {
  suggestOutline(topic: string): Promise<string[]>;
  suggestMeta(title: string, content: string): Promise<{ title: string; description: string }>;
  suggestTags(content: string, limit?: number): Promise<string[]>;
  rephrase(content: string): Promise<string>;
}

export class NullProvider implements AIProvider {
  async suggestOutline(topic: string): Promise<string[]> {
    const normalized = topic.trim();
    if (!normalized) return [];
    return [normalized, `${normalized} insights`, `Next steps for ${normalized}`];
  }

  async suggestMeta(title: string, content: string) {
    const description = summarize(content, 150);
    return {
      title: title.trim() || "Untitled draft",
      description,
    };
  }

  async suggestTags(content: string, limit = 5): Promise<string[]> {
    const words = content
      .toLowerCase()
      .match(/[a-z][a-z0-9]+/g);
    if (!words) return [];
    const frequency = new Map<string, number>();
    for (const word of words) {
      if (STOPWORDS.has(word)) continue;
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }

  async rephrase(content: string): Promise<string> {
    return content.trim();
  }
}

export class OpenAIProvider implements AIProvider {
  private readonly model: string;
  constructor(private readonly apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY");
    }
    this.model = model || process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  private async request(prompt: string, schema?: string): Promise<string> {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: schema ? `${prompt}\n\nFormat:\n${schema}` : prompt,
      }),
    });

    if (!response.ok) {
      const message = await safeText(response);
      throw new Error(`OpenAI request failed: ${response.status} ${message}`);
    }

    const data = (await response.json()) as {
      output_text?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.output_text || data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI response missing content");
    }
    return text.trim();
  }

  async suggestOutline(topic: string): Promise<string[]> {
    const text = await this.request(
      `Create a concise outline for a blog post about "${topic}". Respond as a JSON array of section titles.`,
      "[\"Section 1\", \"Section 2\"]",
    );
    return parseJsonArray(text);
  }

  async suggestMeta(title: string, content: string) {
    const text = await this.request(
      `Generate SEO metadata for the following article. Title: "${title}". Content: ${truncate(content, 800)}. Respond as JSON with \"title\" and \"description\" keys.`,
      '{"title":"...","description":"..."}',
    );
    return parseJsonObject(text);
  }

  async suggestTags(content: string, limit = 5): Promise<string[]> {
    const text = await this.request(
      `Suggest up to ${limit} relevant tags for the following article. Respond as a JSON array of lowercase tags. Content: ${truncate(
        content,
        800,
      )}`,
      "[\"tag\"]",
    );
    return parseJsonArray(text);
  }

  async rephrase(content: string): Promise<string> {
    const text = await this.request(
      `Rephrase the following text to improve clarity while keeping the meaning: ${content}`,
    );
    return text;
  }
}

export class HFProvider implements AIProvider {
  private readonly model: string;
  constructor(private readonly apiKey: string, model?: string) {
    if (!apiKey) {
      throw new Error("Missing HF_API_KEY");
    }
    this.model = model || process.env.AI_MODEL || process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
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

  async suggestOutline(topic: string): Promise<string[]> {
    const text = await this.request(
      `Write outline headings for a blog post about "${topic}". Return headings separated by new lines.`,
    );
    return parseLineArray(text);
  }

  async suggestMeta(title: string, content: string) {
    const text = await this.request(
      `Generate SEO title and description for this article. Title: ${title}. Content: ${truncate(content, 800)}. Format: Title: <title>\nDescription: <description>`,
    );
    return parseMetaLines(text, title);
  }

  async suggestTags(content: string, limit = 5): Promise<string[]> {
    const text = await this.request(
      `Suggest ${limit} short tags for this article. Content: ${truncate(content, 800)}. Return tags separated by commas.`,
    );
    return text
      .split(/[,\n]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, limit);
  }

  async rephrase(content: string): Promise<string> {
    return this.request(`Rewrite the following text with clearer tone while keeping intent: ${content}`);
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

function parseJsonArray(text: string): string[] {
  try {
    const result = JSON.parse(text);
    if (Array.isArray(result)) {
      return result.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch (error) {
    console.error("Failed to parse AI response as JSON array", error);
  }
  return parseLineArray(text);
}

function parseJsonObject(text: string): { title: string; description: string } {
  try {
    const result = JSON.parse(text);
    if (result && typeof result === "object") {
      const title = String((result as Record<string, unknown>).title ?? "Untitled draft");
      const description = String((result as Record<string, unknown>).description ?? "");
      return { title: title.trim(), description: description.trim() };
    }
  } catch (error) {
    console.error("Failed to parse AI response as JSON object", error);
  }
  return {
    title: "Untitled draft",
    description: summarize(text, 150),
  };
}

function parseLineArray(text: string): string[] {
  return text
    .split(/\r?\n|[•\-]\s+/)
    .map((item) => item.replace(/^[-*\d\.\s]+/, "").trim())
    .filter(Boolean);
}

function parseMetaLines(text: string, fallbackTitle: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let title = fallbackTitle;
  let description = "";
  for (const line of lines) {
    if (line.toLowerCase().startsWith("title:")) {
      title = line.slice(6).trim();
    } else if (line.toLowerCase().startsWith("description:")) {
      description = line.slice(12).trim();
    }
  }
  if (!description) {
    description = summarize(text, 150);
  }
  return { title: title || fallbackTitle || "Untitled draft", description };
}

function summarize(content: string, maxLength: number) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
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

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "about",
  "into",
  "onto",
  "using",
  "when",
  "will",
]);
