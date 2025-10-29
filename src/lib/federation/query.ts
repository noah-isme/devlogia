import { tenantConfig } from "@/lib/tenant";

function resolveFederationConfig() {
  const indexUrl = (process.env.FEDERATION_INDEX_URL ?? tenantConfig.federation.indexUrl ?? "").trim();
  const apiKey = (process.env.FEDERATION_API_KEY ?? tenantConfig.federation.apiKey ?? "").trim();

  return {
    indexUrl: indexUrl.length > 0 ? indexUrl : null,
    apiKey: apiKey.length > 0 ? apiKey : null,
    cacheTtlSeconds: tenantConfig.federation.cacheTtlSeconds,
  } as const;
}

type QueryOptions = {
  query?: string;
  limit?: number;
  tenantSlug?: string;
  tags?: string[];
  fetchImpl?: typeof fetch;
};

export type FederationQueryResult = {
  items: Array<{
    postId: string;
    slug: string;
    tenantSlug: string;
    score: number;
    title: string;
    summary?: string | null;
    tags?: string[];
  }>;
  latencyMs: number;
  cache: "hit" | "miss";
  fallback?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  value: FederationQueryResult;
};

const cache = new Map<string, CacheEntry>();

function buildCacheKey(options: QueryOptions) {
  return JSON.stringify({
    query: options.query ?? null,
    limit: options.limit ?? null,
    tenantSlug: options.tenantSlug ?? null,
    tags: options.tags?.slice().sort() ?? [],
  });
}

export async function queryFederationRecommendations(options: QueryOptions = {}): Promise<FederationQueryResult> {
  const federationConfig = resolveFederationConfig();

  if (!federationConfig.indexUrl) {
    throw new Error("Federation index URL is not configured");
  }

  const fetcher = options.fetchImpl ?? fetch;
  const cacheKey = buildCacheKey(options);
  const ttl = federationConfig.cacheTtlSeconds * 1000;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return { ...cached.value, cache: "hit" };
  }

  const start = Date.now();
  const endpoint = `${federationConfig.indexUrl.replace(/\/$/, "")}/query`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (federationConfig.apiKey) {
      headers.Authorization = `Bearer ${federationConfig.apiKey}`;
    }

    const response = await fetcher(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: options.query ?? "",
        limit: options.limit ?? 12,
        tenant: options.tenantSlug ?? process.env.TENANT_SLUG ?? "default",
        tags: options.tags ?? [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Federation query failed with ${response.status}`);
    }

    const body = (await response.json()) as FederationQueryResult;
    const latencyMs = Date.now() - start;
    const result: FederationQueryResult = {
      items: body.items ?? [],
      latencyMs,
      cache: "miss",
      fallback: false,
    };

    cache.set(cacheKey, {
      expiresAt: now + ttl,
      value: result,
    });

    return result;
  } catch (error) {
    console.error("Federation query fallback", error);
    const latencyMs = Date.now() - start;
    const fallbackResult: FederationQueryResult = {
      items: [],
      latencyMs,
      cache: "miss",
      fallback: true,
    };
    cache.set(cacheKey, {
      expiresAt: now + ttl / 2,
      value: fallbackResult,
    });
    return fallbackResult;
  }
}
