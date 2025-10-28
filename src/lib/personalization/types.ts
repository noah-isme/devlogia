import type { Post } from "@prisma/client";

export type EngagementEventType = "session" | "view" | "share" | "feedback";

export type UserEngagementEvent = {
  userId: string;
  postId?: string | null;
  slug?: string | null;
  type: EngagementEventType;
  durationSeconds?: number;
  maxScrollPercent?: number;
  createdAt: Date;
  sentiment?: number | null;
};

export type TopicPreference = {
  name: string;
  weight: number;
  lastSeen: Date;
};

export type UserProfileSnapshot = {
  userId: string;
  segment: string;
  avgReadTimeSeconds: number;
  sessionCount: number;
  viewCount: number;
  topics: TopicPreference[];
  tonePreference: "informative" | "conversational" | "persuasive";
  featureVector: number[];
  personalizationOptOut: boolean;
  analyticsOptOut: boolean;
  lastActiveAt: Date | null;
};

export type ContentVectorSnapshot = {
  postId: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  embedding: number[];
  engagementScore: number;
  freshnessScore: number;
  highlights: string[];
  post: Post;
};

export type AffinityScore = {
  postId: string;
  affinity: number;
  reason: string[];
};

export type PersonalizedFeedOptions = {
  userId: string | null;
  limit?: number;
  fallbackLimit?: number;
  contextPostId?: string;
  forceRefresh?: boolean;
};

export type PersonalizedFeedItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  score: number;
  reason: string[];
  publishedAt: string | null;
  tags: string[];
};

export type PersonalizedFeedResponse = {
  items: PersonalizedFeedItem[];
  cache: "hit" | "miss" | "bypass";
  generatedAt: string;
  latencyMs: number;
  fallback: boolean;
  segment?: string;
};

export type PredictiveInsight = {
  postId: string;
  slug: string;
  title: string;
  predictedCtr: number;
  predictedDwellSeconds: number;
  predictedEngagementProbability: number;
  topDrivers: string[];
  updatedAt: string;
};

export type CreatorInsightSnapshot = {
  posts: PredictiveInsight[];
  refreshedAt: string;
  model: string;
};

export type SummaryResult = {
  summary: string;
  highlights: string[];
  model: string;
  cached: boolean;
  generatedAt: string;
};
