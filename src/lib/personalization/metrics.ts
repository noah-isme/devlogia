import { cosineSimilarity } from "@/lib/ai/embeddings";
import { clamp } from "@/lib/utils";

import type {
  ContentVectorSnapshot,
  TopicPreference,
  UserEngagementEvent,
  UserProfileSnapshot,
} from "@/lib/personalization/types";

type ToneCounter = Record<"informative" | "conversational" | "persuasive", number>;

type AggregateOptions = {
  decayDays?: number;
};

const DEFAULT_DECAY_DAYS = 21;

export function scoreTopicPreferences(
  events: UserEngagementEvent[],
  tagsByPost: Map<string, string[]>,
  options: AggregateOptions = {},
): TopicPreference[] {
  const decayDays = options.decayDays ?? DEFAULT_DECAY_DAYS;
  const now = Date.now();
  const map = new Map<string, { weight: number; lastSeen: Date }>();

  for (const event of events) {
    if (!event.postId) continue;
    const tags = tagsByPost.get(event.postId);
    if (!tags?.length) continue;
    const ageDays = Math.max(0, (now - event.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const decay = Math.exp(-ageDays / decayDays);
    const sessionBoost = event.type === "session" ? 1.2 : event.type === "feedback" ? 0.8 : 1;
    const durationBoost = clamp((event.durationSeconds ?? 0) / 240, 0.2, 2);
    const baseWeight = decay * sessionBoost * durationBoost;

    for (const tag of tags) {
      const key = tag.toLowerCase();
      const current = map.get(key);
      if (current) {
        current.weight += baseWeight;
        if (event.createdAt > current.lastSeen) {
          current.lastSeen = event.createdAt;
        }
      } else {
        map.set(key, { weight: baseWeight, lastSeen: event.createdAt });
      }
    }
  }

  const preferences = Array.from(map.entries()).map(([name, value]) => ({
    name,
    weight: Number(value.weight.toFixed(4)),
    lastSeen: value.lastSeen,
  } satisfies TopicPreference));

  const max = Math.max(...preferences.map((entry) => entry.weight), 0);
  if (max > 0) {
    for (const pref of preferences) {
      pref.weight = Number((pref.weight / max).toFixed(4));
    }
  }
  return preferences.sort((a, b) => b.weight - a.weight).slice(0, 25);
}

export function determineTonePreference(tasks: string[]): "informative" | "conversational" | "persuasive" {
  const counter: ToneCounter = { informative: 1, conversational: 0, persuasive: 0 };
  for (const raw of tasks) {
    const task = raw.toLowerCase();
    if (task.includes("conversational")) {
      counter.conversational += 1;
    } else if (task.includes("persuasive") || task.includes("cta")) {
      counter.persuasive += 1;
    } else if (task.includes("tone")) {
      counter.informative += 1;
    }
  }
  return (Object.entries(counter).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "informative") as
    "informative" | "conversational" | "persuasive";
}

export function determineSegment(profile: {
  avgReadTimeSeconds: number;
  sessionCount: number;
  viewCount: number;
  topicDiversity: number;
  feedbackCount: number;
}): "Explorer" | "Deep Reader" | "Casual" {
  if (profile.avgReadTimeSeconds >= 420 || profile.sessionCount >= 8) {
    return "Deep Reader";
  }
  if (profile.sessionCount >= 3 && profile.topicDiversity >= 4) {
    return "Explorer";
  }
  if (profile.feedbackCount >= 2 && profile.avgReadTimeSeconds >= 240) {
    return "Explorer";
  }
  return "Casual";
}

export function buildFeatureVector(
  engagedContent: ContentVectorSnapshot[],
  weights: number[],
): number[] {
  if (!engagedContent.length) {
    return [];
  }
  const dimension = engagedContent[0]?.embedding.length ?? 0;
  if (!dimension) {
    return [];
  }

  const vector = new Array(dimension).fill(0);
  const safeWeights = weights.length === engagedContent.length ? weights : engagedContent.map(() => 1);
  let totalWeight = 0;
  for (let index = 0; index < engagedContent.length; index += 1) {
    const weight = clamp(safeWeights[index] ?? 1, 0.1, 5);
    const embedding = engagedContent[index]?.embedding ?? [];
    for (let d = 0; d < dimension; d += 1) {
      vector[d] += (embedding[d] ?? 0) * weight;
    }
    totalWeight += weight;
  }
  if (totalWeight > 0) {
    for (let d = 0; d < dimension; d += 1) {
      vector[d] = Number((vector[d] / totalWeight).toFixed(6));
    }
  }
  return vector;
}

export function scoreAffinity(
  profile: UserProfileSnapshot,
  content: ContentVectorSnapshot,
): { score: number; factors: string[] } {
  let topicScore = 0;
  const factors: string[] = [];
  if (profile.topics.length) {
    const match = profile.topics
      .map((topic) => {
        const hit = content.tags.some((tag) => tag.toLowerCase() === topic.name);
        return hit ? topic.weight : 0;
      })
      .reduce((acc, value) => acc + value, 0);
    topicScore = clamp(match / Math.max(1, profile.topics.length), 0, 1);
    if (topicScore > 0) {
      const winning = profile.topics
        .filter((topic) => content.tags.some((tag) => tag.toLowerCase() === topic.name))
        .map((topic) => topic.name);
      if (winning.length) {
        factors.push(`Topic match: ${winning.slice(0, 3).join(", ")}`);
      }
    }
  }

  let vectorScore = 0;
  if (profile.featureVector.length && content.embedding.length && profile.featureVector.length === content.embedding.length) {
    vectorScore = clamp((cosineSimilarity(profile.featureVector, content.embedding) + 1) / 2, 0, 1);
    if (vectorScore > 0.6) {
      factors.push("Embedding similarity");
    }
  }

  const engagementBoost = clamp(content.engagementScore, 0, 1);
  const freshnessBoost = clamp(content.freshnessScore, 0, 1);
  const score = Number((topicScore * 0.45 + vectorScore * 0.35 + engagementBoost * 0.1 + freshnessBoost * 0.1).toFixed(4));

  if (engagementBoost > 0.5) {
    factors.push("High engagement");
  }
  if (freshnessBoost > 0.5) {
    factors.push("Fresh content");
  }

  return { score, factors };
}

export function summarizeHighlights(content: string, limit = 5): string[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/[*_`>#-]/g, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function calculateEngagementScore(events: UserEngagementEvent[]): number {
  if (!events.length) {
    return 0;
  }
  let score = 0;
  for (const event of events) {
    if (event.type === "session") {
      score += clamp((event.durationSeconds ?? 0) / 600, 0.1, 1.5);
    } else if (event.type === "view") {
      score += 0.15;
    } else if (event.type === "share") {
      score += 0.4;
    } else if (event.type === "feedback") {
      score += 0.6;
    }
  }
  const normalized = clamp(score / events.length, 0, 2);
  return Number(Math.min(1, normalized / 1.2).toFixed(4));
}

export function calculateFreshnessScore(publishedAt: Date | null): number {
  if (!publishedAt) {
    return 0.3;
  }
  const ageDays = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);
  const score = Math.exp(-ageDays / 14);
  return Number(clamp(score, 0, 1).toFixed(4));
}

export function blendHighlights(summary: string): string[] {
  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 180)
    .slice(0, 5);
  return sentences.length ? sentences : summarizeHighlights(summary);
}

export function computeProfileSnapshot(params: {
  userId: string;
  events: UserEngagementEvent[];
  topicPreferences: TopicPreference[];
  tonePreference: "informative" | "conversational" | "persuasive";
  featureVector: number[];
  personalizationOptOut: boolean;
  analyticsOptOut: boolean;
}): UserProfileSnapshot {
  const { events, topicPreferences } = params;
  const sessions = events.filter((event) => event.type === "session");
  const avgReadTime = sessions.length
    ? sessions.reduce((acc, event) => acc + (event.durationSeconds ?? 0), 0) / sessions.length
    : 0;
  const viewCount = events.filter((event) => event.type === "view").length;
  const feedbackCount = events.filter((event) => event.type === "feedback").length;
  const lastActiveAt = events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null;

  const segment = determineSegment({
    avgReadTimeSeconds: avgReadTime,
    sessionCount: sessions.length,
    viewCount,
    topicDiversity: topicPreferences.length,
    feedbackCount,
  });

  return {
    userId: params.userId,
    segment,
    avgReadTimeSeconds: Math.round(avgReadTime),
    sessionCount: sessions.length,
    viewCount,
    topics: topicPreferences,
    tonePreference: params.tonePreference,
    featureVector: params.featureVector,
    personalizationOptOut: params.personalizationOptOut,
    analyticsOptOut: params.analyticsOptOut,
    lastActiveAt,
  } satisfies UserProfileSnapshot;
}
