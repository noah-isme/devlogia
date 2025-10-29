import { performance } from "node:perf_hooks";

import { prisma } from "@/lib/prisma";
import { tenantConfig } from "@/lib/tenant";

export type FederationItem = {
  postId: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  embedding: unknown;
  updatedAt: string;
};

export type FederationPayload = {
  tenant: {
    slug: string;
    plan: string;
    mode: string;
  };
  generatedAt: string;
  items: FederationItem[];
};

export type PublishOptions = {
  limit?: number;
  tenantSlug?: string;
  push?: boolean;
  fetchImpl?: typeof fetch;
};

function resolveFederationConfig() {
  const indexUrl = (process.env.FEDERATION_INDEX_URL ?? tenantConfig.federation.indexUrl ?? "").trim();
  const apiKey = (process.env.FEDERATION_API_KEY ?? tenantConfig.federation.apiKey ?? "").trim();

  return {
    indexUrl: indexUrl.length > 0 ? indexUrl : null,
    apiKey: apiKey.length > 0 ? apiKey : null,
  } as const;
}

export async function buildFederationPayload(options: PublishOptions = {}): Promise<FederationPayload> {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(options.limit) && options.limit ? Math.max(options.limit, 1) : 25,
    include: {
      tags: { include: { tag: true } },
      embedding: true,
      federationIndex: true,
    },
  });

  return {
    tenant: {
      slug: options.tenantSlug ?? process.env.TENANT_SLUG ?? "default",
      plan: tenantConfig.defaultPlan,
      mode: tenantConfig.mode,
    },
    generatedAt: new Date().toISOString(),
    items: posts.map((post) => ({
      postId: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary ?? null,
      tags: post.tags.map((entry) => entry.tag.slug),
      embedding: post.embedding?.vector ?? null,
      updatedAt: post.updatedAt.toISOString(),
    })),
  };
}

export async function publishFederationIndex(options: PublishOptions = {}) {
  const start = performance.now();
  const payload = await buildFederationPayload(options);

  const federationConfig = resolveFederationConfig();

  if (!options.push || !federationConfig.indexUrl || !federationConfig.apiKey) {
    return {
      status: "dry-run" as const,
      payload,
      durationMs: performance.now() - start,
    };
  }

  const fetcher = options.fetchImpl ?? fetch;
  const endpoint = `${federationConfig.indexUrl.replace(/\/$/, "")}/ingest`;
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${federationConfig.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Federation publish failed with ${response.status} ${response.statusText}: ${detail}`);
  }

  return {
    status: "published" as const,
    payload,
    durationMs: performance.now() - start,
  };
}

export function scheduleFederationPublishing(options: PublishOptions & { intervalMinutes?: number } = {}) {
  const intervalMinutes = options.intervalMinutes ?? 30;
  const intervalMs = Math.max(intervalMinutes, 1) * 60_000;

  const execute = async () => {
    const startedAt = new Date();
    try {
      const result = await publishFederationIndex({ ...options, push: true });
      console.info(
        `[federation] ${startedAt.toISOString()} published ${result.payload.items.length} items in ${result.durationMs.toFixed(
          1,
        )}ms`,
      );
    } catch (error) {
      console.error(`[federation] ${startedAt.toISOString()} publish failed`, error);
    }
  };

  void execute();
  return setInterval(execute, intervalMs);
}
