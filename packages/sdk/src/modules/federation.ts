import { HttpClient } from "../client";

export type FederationRequest = {
  query?: string;
  limit?: number;
  tags?: string[];
};

export type FederationResponse = {
  items: Array<{
    id: string;
    title: string;
    score: number;
    excerpt: string | null;
    publishedAt: string | null;
  }>;
  latencyMs: number;
  fallback: boolean;
};

export class FederationModule {
  constructor(private readonly client: HttpClient) {}

  query(input: FederationRequest) {
    return this.client.request<FederationResponse>("/api/federation/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}
