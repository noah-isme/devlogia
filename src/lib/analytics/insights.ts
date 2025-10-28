import { classifySentiments, sentimentScore, type SentimentResult } from "@/lib/ai/sentiment";
import { logger } from "@/lib/logger";
import { initRedis } from "@/lib/redis";

const TEN_MINUTES = 600;

export type TelemetryRecord = {
  type: "session" | "view" | "share" | "feedback" | "unknown";
  createdAt: Date;
  page?: string;
  slug?: string;
  durationSeconds?: number;
  maxScrollPercent?: number;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type DailyInsight = {
  date: string;
  sessionCount: number;
  viewCount: number;
  shareCount: number;
  avgReadTimeSeconds: number;
  avgScrollDepth: number;
  bounceRate: number;
  feedbackCount: number;
  sentiment: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
  };
};

export type PageInsight = {
  page: string;
  sessions: number;
  views: number;
  avgReadTimeSeconds: number;
  avgScrollDepth: number;
};

export type FeedbackHighlight = {
  message: string;
  sentiment: SentimentResult;
  page?: string;
  createdAt: string;
};

export type InsightsSummary = {
  generatedAt: string;
  range: { start: string; end: string; days: number };
  totals: {
    sessions: number;
    views: number;
    shares: number;
    avgReadTimeSeconds: number;
    avgScrollDepth: number;
    bounceRate: number;
    feedbackCount: number;
    sentimentScore: number;
    positiveFeedbackRatio: number;
  };
  daily: DailyInsight[];
  topPages: PageInsight[];
  feedback: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    highlights: FeedbackHighlight[];
  };
};

export type AggregateOptions = {
  sentimentClassifier?: (messages: string[]) => Promise<SentimentResult[]>;
};

const DEFAULT_SENTIMENT_CLASSIFIER = classifySentiments;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parsePage(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function parseNumber(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function parseTelemetryMeta(record: unknown) {
  if (!record || typeof record !== "object") {
    return { payload: {} as Record<string, unknown> };
  }
  if ("payload" in record && typeof (record as { payload: unknown }).payload === "object") {
    return record as { payload: Record<string, unknown>; event?: string };
  }
  return { payload: record as Record<string, unknown> };
}

export function mapAuditLogToTelemetry(log: { action: string; createdAt: Date; meta: unknown }): TelemetryRecord | null {
  const meta = parseTelemetryMeta(log.meta);
  const payload = meta.payload ?? {};
  const createdAt = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
  const action = log.action || meta.event || "";

  if (action === "telemetry:page-session") {
    const durationSeconds = clamp(parseNumber(payload.durationSeconds ?? payload.duration ?? 0), 0, 86_400);
    const maxScrollPercent = clamp(parseNumber(payload.maxScrollPercent ?? payload.maxScroll ?? 0), 0, 100);
    return {
      type: "session",
      createdAt,
      page: parsePage(payload.page),
      slug: parsePage(payload.slug),
      durationSeconds,
      maxScrollPercent,
      metadata: payload,
    };
  }

  if (action === "telemetry:page-view") {
    return {
      type: "view",
      createdAt,
      page: parsePage(payload.page),
      slug: parsePage(payload.slug),
      metadata: payload,
    };
  }

  if (action === "telemetry:share") {
    return {
      type: "share",
      createdAt,
      page: parsePage(payload.page),
      slug: parsePage(payload.slug),
      metadata: payload,
    };
  }

  if (action === "telemetry:feedback") {
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message) {
      return null;
    }
    return {
      type: "feedback",
      createdAt,
      page: parsePage(payload.page ?? payload.slug),
      slug: parsePage(payload.slug),
      message,
      metadata: payload,
    };
  }

  return {
    type: "unknown",
    createdAt,
    page: parsePage(payload.page),
    slug: parsePage(payload.slug),
    metadata: payload,
  };
}

export async function aggregateTelemetry(
  records: TelemetryRecord[],
  options: AggregateOptions = {},
): Promise<InsightsSummary> {
  const classifier = options.sentimentClassifier ?? DEFAULT_SENTIMENT_CLASSIFIER;
  const dayMap = new Map<
    string,
    {
      date: string;
      sessions: number;
      views: number;
      shares: number;
      totalDuration: number;
      totalScroll: number;
      bounceCount: number;
      feedbackMessages: Array<{ message: string; page?: string; createdAt: Date }>;
    }
  >();
  const pageMap = new Map<
    string,
    {
      page: string;
      sessions: number;
      views: number;
      totalDuration: number;
      totalScroll: number;
    }
  >();
  const feedbackMessages: Array<{ message: string; page?: string; createdAt: Date }> = [];

  for (const record of records) {
    const dateKey = formatDateKey(record.createdAt);
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        date: dateKey,
        sessions: 0,
        views: 0,
        shares: 0,
        totalDuration: 0,
        totalScroll: 0,
        bounceCount: 0,
        feedbackMessages: [],
      });
    }
    const day = dayMap.get(dateKey)!;

    if (record.page) {
      if (!pageMap.has(record.page)) {
        pageMap.set(record.page, { page: record.page, sessions: 0, views: 0, totalDuration: 0, totalScroll: 0 });
      }
    }

    if (record.type === "session") {
      day.sessions += 1;
      day.totalDuration += record.durationSeconds ?? 0;
      day.totalScroll += record.maxScrollPercent ?? 0;
      if ((record.durationSeconds ?? 0) < 30 || (record.maxScrollPercent ?? 0) < 25) {
        day.bounceCount += 1;
      }

      if (record.page) {
        const page = pageMap.get(record.page)!;
        page.sessions += 1;
        page.totalDuration += record.durationSeconds ?? 0;
        page.totalScroll += record.maxScrollPercent ?? 0;
      }
    } else if (record.type === "view") {
      day.views += 1;
      if (record.page) {
        const page = pageMap.get(record.page)!;
        page.views += 1;
      }
    } else if (record.type === "share") {
      day.shares += 1;
    } else if (record.type === "feedback" && record.message) {
      day.feedbackMessages.push({ message: record.message, page: record.page, createdAt: record.createdAt });
      feedbackMessages.push({ message: record.message, page: record.page, createdAt: record.createdAt });
    }
  }

  const daily: DailyInsight[] = [];
  let totalSessions = 0;
  let totalViews = 0;
  let totalShares = 0;
  let totalDuration = 0;
  let totalScroll = 0;
  let totalFeedback = 0;
  let totalSentimentScore = 0;
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sortedDays) {
    const sentiments = await classifier(day.feedbackMessages.map((entry) => entry.message));
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    let sentimentTotal = 0;
    sentiments.forEach((result) => {
      if (result.label === "positive") {
        positive += 1;
      } else if (result.label === "negative") {
        negative += 1;
      } else {
        neutral += 1;
      }
      sentimentTotal += sentimentScore(result);
    });

    const sessionCount = day.sessions;
    const viewCount = day.views;
    const shareCount = day.shares;
    const feedbackCount = day.feedbackMessages.length;
    const avgReadTimeSeconds = sessionCount ? day.totalDuration / sessionCount : 0;
    const avgScrollDepth = sessionCount ? day.totalScroll / sessionCount : 0;
    const bounceRate = sessionCount ? day.bounceCount / sessionCount : 0;
    const daySentimentScore = feedbackCount ? sentimentTotal / feedbackCount : 0;

    totalSessions += sessionCount;
    totalViews += viewCount;
    totalShares += shareCount;
    totalDuration += day.totalDuration;
    totalScroll += day.totalScroll;
    totalFeedback += feedbackCount;
    totalSentimentScore += daySentimentScore * feedbackCount;
    totalPositive += positive;
    totalNegative += negative;
    totalNeutral += neutral;

    daily.push({
      date: day.date,
      sessionCount,
      viewCount,
      shareCount,
      avgReadTimeSeconds,
      avgScrollDepth,
      bounceRate,
      feedbackCount,
      sentiment: {
        score: daySentimentScore,
        positive,
        negative,
        neutral,
      },
    });
  }

  const topPages = Array.from(pageMap.values())
    .filter((entry) => entry.sessions > 0 || entry.views > 0)
    .map<PageInsight>((entry) => ({
      page: entry.page,
      sessions: entry.sessions,
      views: entry.views,
      avgReadTimeSeconds: entry.sessions ? entry.totalDuration / entry.sessions : 0,
      avgScrollDepth: entry.sessions ? entry.totalScroll / entry.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.views - a.views)
    .slice(0, 8);

  const feedbackSentiments = await classifier(feedbackMessages.map((entry) => entry.message));
  const highlights: FeedbackHighlight[] = feedbackSentiments
    .map((sentiment, index) => ({
      sentiment,
      message: feedbackMessages[index]?.message ?? "",
      page: feedbackMessages[index]?.page,
      createdAt: feedbackMessages[index]?.createdAt.toISOString() ?? new Date().toISOString(),
    }))
    .filter((entry) => entry.message)
    .sort((a, b) => Math.abs(sentimentScore(b.sentiment)) - Math.abs(sentimentScore(a.sentiment)))
    .slice(0, 6);

  const totals = {
    sessions: totalSessions,
    views: totalViews,
    shares: totalShares,
    avgReadTimeSeconds: totalSessions ? totalDuration / totalSessions : 0,
    avgScrollDepth: totalSessions ? totalScroll / totalSessions : 0,
    bounceRate: totalSessions ? daily.reduce((acc, day) => acc + day.bounceRate * day.sessionCount, 0) / totalSessions : 0,
    feedbackCount: totalFeedback,
    sentimentScore: totalFeedback ? totalSentimentScore / totalFeedback : 0,
    positiveFeedbackRatio: totalFeedback ? totalPositive / totalFeedback : 0,
  };

  const feedbackSummary = {
    total: totalFeedback,
    positive: totalPositive,
    negative: totalNegative,
    neutral: totalNeutral,
    highlights,
  };

  const now = new Date();
  const rangeStart = daily.length ? daily[0]!.date : formatDateKey(new Date(now.getTime() - 29 * 86_400_000));
  const rangeEnd = daily.length ? daily[daily.length - 1]!.date : formatDateKey(now);

  return {
    generatedAt: now.toISOString(),
    range: { start: rangeStart, end: rangeEnd, days: daily.length || 30 },
    totals,
    daily,
    topPages,
    feedback: feedbackSummary,
  };
}

async function fetchTelemetryRecords(rangeDays: number) {
  const prismaModule = await import("@/lib/prisma");
  const { prisma, isDatabaseEnabled } = prismaModule;
  if (!isDatabaseEnabled) {
    return [] as TelemetryRecord[];
  }
  const since = new Date(Date.now() - rangeDays * 86_400_000);
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: since },
      action: {
        in: ["telemetry:page-session", "telemetry:page-view", "telemetry:share", "telemetry:feedback"],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return logs
    .map((log) => mapAuditLogToTelemetry(log))
    .filter((record): record is TelemetryRecord => Boolean(record));
}

function getCacheKey(rangeDays: number) {
  return `insights:summary:v2:${rangeDays}`;
}

export async function getInsightsSummary(rangeDays = 30) {
  const redis = await initRedis();
  const cacheKey = getCacheKey(rangeDays);
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as InsightsSummary;
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed to read insights cache");
    }
  }

  const records = await fetchTelemetryRecords(rangeDays);
  const summary = await aggregateTelemetry(records);

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(summary), "EX", TEN_MINUTES);
    } catch (error) {
      logger.warn({ err: error }, "Failed to store insights cache");
    }
  }

  return summary;
}
