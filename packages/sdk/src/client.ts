import fetch from "cross-fetch";

export type DevlogiaSDKOptions = {
  /** API token issued to the partner; falls back to SDK_PUBLISH_TOKEN */
  token?: string;
  /** Base URL for Devlogia API */
  baseUrl?: string;
  /** Optional tenant identifier when scoping requests */
  tenantId?: string;
  /** Custom fetch implementation */
  fetcher?: typeof fetch;
};

export class HttpClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly tenantId?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: DevlogiaSDKOptions = {}) {
    const token = options.token ?? process.env.SDK_PUBLISH_TOKEN;
    if (!token) {
      throw new Error("Devlogia SDK requires a token or SDK_PUBLISH_TOKEN env variable");
    }
    this.token = token;
    this.baseUrl = options.baseUrl ?? "https://api.devlogia.com";
    this.tenantId = options.tenantId;
    this.fetcher = options.fetcher ?? fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (this.tenantId) {
      url.searchParams.set("tenantId", this.tenantId);
    }

    const start = performance.now();

    const response = await this.fetcher(url.toString(), {
      ...init,
      headers: {
        "User-Agent": "devlogia-sdk/1.0.0-beta",
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`,
        ...(init.headers ?? {}),
      },
    });

    const latencyMs = performance.now() - start;
    if (typeof globalThis !== "undefined") {
      (globalThis as Record<string, unknown>).__DEVLOGIA_SDK_LAST_LATENCY__ = latencyMs;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`Devlogia request failed: ${response.status} ${errorBody}`);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }
}
