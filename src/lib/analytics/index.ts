import type { PostStatus } from "@prisma/client";

export type PostStatusCount = {
  status: PostStatus;
  _count: { status: number };
};

export type PostLike = {
  id: string;
  createdAt: Date;
  publishedAt: Date | null;
  status: PostStatus;
};

export type AnalyticsSnapshot = {
  posts: {
    total: number;
    published: number;
    draft: number;
    scheduled: number;
    views: number;
  };
  pages: {
    total: number;
    published: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  tags: {
    total: number;
    top: Array<{ name: string; count: number }>;
  };
  traffic: {
    timeframe: string;
    points: Array<{ label: string; views: number }>;
  };
  generatedAt: string;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function pseudoRandomFromString(seed: string | undefined | null) {
  if (!seed || typeof seed !== "string") {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function computePostStatusSummary(grouped: PostStatusCount[]) {
  const summary = {
    total: 0,
    published: 0,
    draft: 0,
    scheduled: 0,
  };

  for (const entry of grouped) {
    const count = entry._count.status;
    summary.total += count;
    if (entry.status === "PUBLISHED") {
      summary.published += count;
    }
    if (entry.status === "DRAFT") {
      summary.draft += count;
    }
    if (entry.status === "SCHEDULED") {
      summary.scheduled += count;
    }
  }

  return summary;
}

export function computeViewTotal(posts: PostLike[]) {
  return posts.reduce((acc, post) => acc + 400 + (pseudoRandomFromString(post.id) % 600), 0);
}

export function buildMonthlyViewSeries(posts: PostLike[], months = 6) {
  const now = new Date();
  const buckets: Array<{ label: string; date: Date; views: number }> = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({
      label: `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
      date,
      views: 0,
    });
  }

  for (const post of posts) {
    const anchor = post.publishedAt ?? post.createdAt;
    const diffMonths = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
    if (diffMonths < 0 || diffMonths >= months) {
      continue;
    }
    const bucketIndex = months - diffMonths - 1;
    const bucket = buckets[bucketIndex];
    bucket.views += 400 + (pseudoRandomFromString(`${post.id}:${anchor.getMonth()}`) % 600);
  }

  return buckets.map(({ label, views }) => ({ label, views }));
}

export function mapTopTags(
  tags: Array<{ id: string; name: string }>,
  counts: Array<{ tagId: string; _count: { tagId: number } }>,
) {
  const lookup = new Map(tags.map((tag) => [tag.id, tag.name]));
  return counts
    .map((entry) => ({ name: lookup.get(entry.tagId) ?? entry.tagId, count: entry._count.tagId }))
    .filter((item) => item.count > 0);
}
