import { createHmac, timingSafeEqual } from "node:crypto";

import { fetchWithRetry } from "@/lib/ai/request";

export type NewsSource = {
  title: string;
  description: string;
  publisher: string;
  publishedAt: string;
  url: string;
};

type NewsProvider = "gnews" | "newsapi";
type SignedResearch = { expiresAt: number; sources: NewsSource[] };

export class NewsResearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function searchCurrentNews(query: string, limit = 6): Promise<NewsSource[]> {
  const provider = (process.env.NEWS_PROVIDER || "none").toLowerCase() as NewsProvider | "none";
  const apiKey = provider === "gnews" ? process.env.GNEWS_API_KEY : provider === "newsapi" ? process.env.NEWS_API_KEY : undefined;
  if (!apiKey || provider === "none") {
    throw new NewsResearchError("News research is not configured", 503);
  }

  const safeLimit = Math.max(1, Math.min(limit, 10));
  const url = new URL(provider === "gnews" ? "https://gnews.io/api/v4/search" : "https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(safeLimit));
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("language", process.env.NEWS_LANGUAGE || "en");
  if (provider === "gnews") {
    url.searchParams.set("token", apiKey);
  } else {
    url.searchParams.set("apiKey", apiKey);
  }

  const response = await fetchWithRetry(url.toString(), { headers: { Accept: "application/json" } }, { timeoutMs: 12_000, retries: 1 });
  if (!response.ok) {
    throw new NewsResearchError(`News provider request failed (${response.status})`, 502);
  }
  const data = (await response.json()) as { articles?: Array<{ title?: string; description?: string | null; url?: string; publishedAt?: string; source?: { name?: string | null } }> };
  return (data.articles ?? [])
    .flatMap((article) => {
      if (!article.title || !article.url || !isHttpUrl(article.url)) return [];
      const publishedAt = new Date(article.publishedAt ?? "");
      if (Number.isNaN(publishedAt.getTime())) return [];
      return [{
        title: article.title.slice(0, 300),
        description: (article.description ?? "No excerpt supplied by the news provider.").slice(0, 1_000),
        publisher: (article.source?.name ?? "Unknown publisher").slice(0, 200),
        publishedAt: publishedAt.toISOString(),
        url: article.url,
      } satisfies NewsSource];
    })
    .slice(0, safeLimit);
}

export function signResearchSources(sources: NewsSource[]) {
  const secret = signingSecret();
  if (!secret) throw new NewsResearchError("News research signing is not configured", 503);
  const payload = Buffer.from(JSON.stringify({ expiresAt: Date.now() + 15 * 60_000, sources } satisfies SignedResearch)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyResearchSources(token: string, selectedUrls: string[]): NewsSource[] | null {
  const secret = signingSecret();
  const [payload, signature] = token.split(".");
  if (!secret || !payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedResearch;
    if (!Number.isFinite(decoded.expiresAt) || decoded.expiresAt < Date.now() || !Array.isArray(decoded.sources)) return null;
    const urls = new Set(selectedUrls);
    const sources = decoded.sources.filter((source) => urls.has(source.url));
    return sources.length === selectedUrls.length && sources.every((source) => isHttpUrl(source.url)) ? sources : null;
  } catch {
    return null;
  }
}

function signingSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
