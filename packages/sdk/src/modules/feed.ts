import { HttpClient } from "../client";

export type FeedItem = {
  id: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
  tags: string[];
};

export class FeedModule {
  constructor(private readonly client: HttpClient) {}

  list(params: { limit?: number; tag?: string } = {}) {
    const query = new URLSearchParams();
    if (params.limit) {
      query.set("limit", String(params.limit));
    }
    if (params.tag) {
      query.set("tag", params.tag);
    }
    const path = `/api/feed?${query.toString()}`;
    return this.client.request<{ items: FeedItem[] }>(path);
  }
}
