import { describe, expect, it, vi } from "vitest";

import {
  buildMonthlyViewSeries,
  computePostStatusSummary,
  computeViewTotal,
  mapTopTags,
  pseudoRandomFromString,
} from "@/lib/analytics";

describe("analytics helpers", () => {
  it("summarizes post statuses", () => {
    const summary = computePostStatusSummary([
      { status: "PUBLISHED", _count: { status: 5 } },
      { status: "DRAFT", _count: { status: 2 } },
      { status: "SCHEDULED", _count: { status: 1 } },
    ]);

    expect(summary.total).toBe(8);
    expect(summary.published).toBe(5);
    expect(summary.draft).toBe(2);
    expect(summary.scheduled).toBe(1);
  });

  it("computes deterministic view totals", () => {
    const posts = [
      { id: "a", createdAt: new Date("2024-01-01"), publishedAt: new Date("2024-01-02"), status: "PUBLISHED" },
      { id: "b", createdAt: new Date("2024-01-03"), publishedAt: null, status: "DRAFT" },
    ];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-01"));
    const total = computeViewTotal(posts);
    expect(total).toBe(computeViewTotal(posts));
    vi.useRealTimers();
  });

  it("builds monthly view series capped to the requested range", () => {
    const posts = [
      { id: "recent", createdAt: new Date("2024-05-15"), publishedAt: new Date("2024-05-20"), status: "PUBLISHED" },
      { id: "older", createdAt: new Date("2023-10-01"), publishedAt: new Date("2023-10-05"), status: "PUBLISHED" },
    ];
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
    const series = buildMonthlyViewSeries(posts, 6);
    expect(series).toHaveLength(6);
    expect(series.at(-2)?.views).toBeGreaterThan(0);
    expect(series.at(-1)?.views).toBe(0);
    expect(series[0]?.views).toBe(0);
    vi.useRealTimers();
  });

  it("maps tag counts to friendly labels", () => {
    const tags = [
      { id: "t1", name: "Next.js" },
      { id: "t2", name: "DevOps" },
    ];
    const counts = [
      { tagId: "t1", _count: { tagId: 3 } },
      { tagId: "missing", _count: { tagId: 1 } },
    ];
    const mapped = mapTopTags(tags, counts);
    expect(mapped).toEqual([
      { name: "Next.js", count: 3 },
      { name: "missing", count: 1 },
    ]);
  });

  it("produces stable pseudo random values", () => {
    expect(pseudoRandomFromString("devlogia")).toBe(pseudoRandomFromString("devlogia"));
  });
});
