import { HttpClient } from "../client";

export type InsightSummary = {
  timeframe: string;
  topPages: Array<{ slug: string; views: number; sessions: number }>;
  sentimentScore: number;
  aiUsageUsd: number;
};

export class InsightsModule {
  constructor(private readonly client: HttpClient) {}

  summary(timeframe: "7d" | "30d" | "90d" = "30d") {
    return this.client.request<InsightSummary>(`/api/insights?timeframe=${timeframe}`);
  }
}
