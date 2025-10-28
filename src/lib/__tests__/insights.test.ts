import { describe, expect, it } from "vitest";

import { aggregateTelemetry, type TelemetryRecord } from "@/lib/analytics/insights";

const stubClassifier = async (messages: string[]) =>
  messages.map((message) => ({
    label: message.includes("love") ? "positive" : message.includes("bad") ? "negative" : "neutral",
    score: message.includes("love") ? 0.9 : message.includes("bad") ? 0.8 : 0.5,
  }));

describe("aggregateTelemetry", () => {
  it("summarizes sessions, sentiment, and top pages", async () => {
    const records: TelemetryRecord[] = [
      {
        type: "session",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        page: "/posts/one",
        durationSeconds: 120,
        maxScrollPercent: 90,
      },
      {
        type: "session",
        createdAt: new Date("2024-01-01T13:00:00Z"),
        page: "/posts/one",
        durationSeconds: 20,
        maxScrollPercent: 10,
      },
      {
        type: "view",
        createdAt: new Date("2024-01-01T12:00:00Z"),
        page: "/posts/one",
      },
      {
        type: "share",
        createdAt: new Date("2024-01-01T13:00:00Z"),
        page: "/posts/one",
      },
      {
        type: "feedback",
        createdAt: new Date("2024-01-01T14:00:00Z"),
        page: "/posts/one",
        message: "I love the depth of this article",
      },
      {
        type: "session",
        createdAt: new Date("2024-01-02T12:00:00Z"),
        page: "/posts/two",
        durationSeconds: 45,
        maxScrollPercent: 60,
      },
      {
        type: "feedback",
        createdAt: new Date("2024-01-02T13:00:00Z"),
        page: "/posts/two",
        message: "The structure is bad and confusing",
      },
    ];

    const summary = await aggregateTelemetry(records, { sentimentClassifier: stubClassifier });

    expect(summary.totals.sessions).toBe(3);
    expect(summary.totals.shares).toBe(1);
    expect(summary.totals.feedbackCount).toBe(2);
    expect(summary.daily).toHaveLength(2);
    expect(summary.daily[0]?.sessionCount).toBe(2);
    expect(summary.daily[0]?.bounceRate).toBeCloseTo(0.5);
    expect(summary.topPages[0]?.page).toBe("/posts/one");
    expect(summary.feedback.highlights).toHaveLength(2);
    expect(summary.feedback.positive).toBe(1);
    expect(summary.feedback.negative).toBe(1);
  });
});
