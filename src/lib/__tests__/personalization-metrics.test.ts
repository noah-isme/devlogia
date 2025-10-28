import { describe, expect, it } from "vitest";

import {
  buildFeatureVector,
  computeProfileSnapshot,
  determineTonePreference,
  scoreAffinity,
  scoreTopicPreferences,
} from "@/lib/personalization/metrics";
import type { ContentVectorSnapshot, UserEngagementEvent } from "@/lib/personalization/types";

describe("personalization metrics", () => {
  it("scores topic preferences by recency and duration", () => {
    const now = new Date();
    const events: UserEngagementEvent[] = [
      { userId: "u", postId: "p1", slug: "a", type: "session", durationSeconds: 600, createdAt: now },
      {
        userId: "u",
        postId: "p2",
        slug: "b",
        type: "session",
        durationSeconds: 120,
        createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      },
    ];
    const tags = new Map<string, string[]>([
      ["p1", ["react", "hooks"]],
      ["p2", ["testing"]],
    ]);
    const preferences = scoreTopicPreferences(events, tags, { decayDays: 7 });
    expect(preferences[0]?.name).toBe("react");
    expect(preferences[0]?.weight).toBeGreaterThanOrEqual(preferences[1]?.weight ?? 0);
  });

  it("builds feature vectors from engagement", () => {
    const content: ContentVectorSnapshot[] = [
      {
        postId: "p1",
        slug: "one",
        title: "One",
        summary: null,
        tags: [],
        embedding: [1, 0],
        engagementScore: 0.6,
        freshnessScore: 0.4,
        highlights: [],
        post: { id: "p1", slug: "one", title: "One", summary: null, contentMdx: "", coverUrl: null, status: "PUBLISHED", authorId: "a", publishedAt: null, createdAt: new Date(), updatedAt: new Date() } as unknown as ContentVectorSnapshot["post"],
      },
      {
        postId: "p2",
        slug: "two",
        title: "Two",
        summary: null,
        tags: [],
        embedding: [0, 1],
        engagementScore: 0.4,
        freshnessScore: 0.6,
        highlights: [],
        post: { id: "p2", slug: "two", title: "Two", summary: null, contentMdx: "", coverUrl: null, status: "PUBLISHED", authorId: "a", publishedAt: null, createdAt: new Date(), updatedAt: new Date() } as unknown as ContentVectorSnapshot["post"],
      },
    ];
    const vector = buildFeatureVector(content, [1, 2]);
    expect(vector).toHaveLength(2);
    expect(vector[1]).toBeGreaterThan(vector[0]);
  });

  it("scores affinity combining topics and vectors", () => {
    const profile = computeProfileSnapshot({
      userId: "u",
      events: [],
      topicPreferences: [{ name: "react", weight: 1, lastSeen: new Date() }],
      tonePreference: "informative",
      featureVector: [1, 0],
      personalizationOptOut: false,
      analyticsOptOut: false,
    });
    const content: ContentVectorSnapshot = {
      postId: "post",
      slug: "post",
      title: "React hooks",
      summary: null,
      tags: ["react"],
      embedding: [1, 0],
      engagementScore: 0.7,
      freshnessScore: 0.5,
      highlights: [],
      post: { id: "post", slug: "post", title: "React hooks", summary: null, contentMdx: "", coverUrl: null, status: "PUBLISHED", authorId: "x", publishedAt: null, createdAt: new Date(), updatedAt: new Date() } as unknown as ContentVectorSnapshot["post"],
    };
    const { score, factors } = scoreAffinity(profile, content);
    expect(score).toBeGreaterThan(0.5);
    expect(factors.some((factor) => factor.includes("Topic match"))).toBe(true);
  });

  it("infers tone preference from task history", () => {
    const tone = determineTonePreference(["tone:conversational", "writer", "tone:persuasive"]);
    expect(["informative", "conversational", "persuasive"]).toContain(tone);
  });
});
