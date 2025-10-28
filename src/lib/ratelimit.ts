import { createHash } from "node:crypto";

import type Redis from "ioredis";

import { getRedis, getRedisLastError, initRedis } from "@/lib/redis";

const memoryBuckets = new Map<string, { tokens: number; updatedAt: number }>();
const memoryDenylist = new Map<string, number>();
const memoryDenyCounts = new Map<string, number>();

const ONE_MINUTE = 60_000;
const DEFAULT_WINDOW_MS = ONE_MINUTE;
const MAX_BLOCK_MS = 60 * ONE_MINUTE;
const BASE_BLOCK_MS = 30_000;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
  blocked?: boolean;
};

export type RateLimitHeaders = {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
};

const allowlist = new Set(
  (process.env.RATE_LIMIT_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

export type RateLimitOptions = {
  windowMs?: number;
  refillRate?: number;
  now?: number;
  bypass?: boolean;
};

function resolveNow(now?: number) {
  return typeof now === "number" ? now : Date.now();
}

function buildMemoryKey(identifier: string, windowMs: number) {
  const digest = createHash("sha1").update(identifier).digest("hex");
  return `${windowMs}:${digest}`;
}

function consumeMemoryBucket(identifier: string, limit: number, options: RateLimitOptions): RateLimitResult {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = resolveNow(options.now);
  const refillRate = options.refillRate ?? limit / windowMs;
  const key = buildMemoryKey(identifier, windowMs);

  const bucket = memoryBuckets.get(key) ?? { tokens: limit, updatedAt: now };
  const elapsed = now - bucket.updatedAt;
  if (elapsed > 0) {
    const refillTokens = elapsed * refillRate;
    if (refillTokens > 0) {
      bucket.tokens = Math.min(limit, bucket.tokens + refillTokens);
      bucket.updatedAt = now;
    }
  }

  if (bucket.tokens < 1) {
    const reset = bucket.updatedAt + windowMs;
    const retryAfter = Math.max(0, Math.ceil((1 - bucket.tokens) / refillRate));
    memoryBuckets.set(key, bucket);
    return {
      success: false,
      remaining: 0,
      reset,
      retryAfter,
      limit,
    };
  }

  bucket.tokens -= 1;
  memoryBuckets.set(key, bucket);

  return {
    success: true,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
    reset: bucket.updatedAt + windowMs,
    limit,
  };
}

async function ensureRedisClient() {
  const existing = getRedis();
  if (existing) {
    return existing;
  }
  return initRedis();
}

async function consumeRedisBucket(
  redis: Redis,
  identifier: string,
  limit: number,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = resolveNow(options.now);
  const refillRate = options.refillRate ?? limit / windowMs;
  const key = `ratelimit:${windowMs}:${identifier}`;

  const script = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local ttl = tonumber(ARGV[4])

  local data = redis.call('HMGET', key, 'tokens', 'updated_at')
  local tokens = tonumber(data[1])
  local updated = tonumber(data[2])

  if tokens == nil or updated == nil then
    tokens = capacity
    updated = now
  else
    local elapsed = math.max(0, now - updated)
    local refillTokens = elapsed * refill
    if refillTokens > 0 then
      tokens = math.min(capacity, tokens + refillTokens)
      updated = now
    end
  end

  local allowed = 0
  if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
  end

  redis.call('HMSET', key, 'tokens', tokens, 'updated_at', updated)
  redis.call('PEXPIRE', key, ttl)

  local remaining = math.max(0, math.floor(tokens))
  local reset = updated + ttl
  local retryAfter = 0
  if allowed == 0 then
    if refill > 0 then
      retryAfter = math.ceil((1 - tokens) / refill)
    else
      retryAfter = ttl / 1000
    end
  end

  return { allowed, remaining, reset, retryAfter }
`;

  const result = (await redis.eval(script, 1, key, limit, refillRate, now, windowMs)) as [
    number,
    number,
    number,
    number,
  ];

  const [allowed, remaining, reset, retryAfterSeconds] = result;
  return {
    success: allowed === 1,
    remaining,
    reset,
    retryAfter: retryAfterSeconds,
    limit,
  };
}

async function isDenylisted(redis: Redis | null, identifier: string) {
  const now = Date.now();

  if (redis) {
    const blockedUntil = await redis.get(`deny:${identifier}:until`);
    if (blockedUntil) {
      const until = Number(blockedUntil);
      if (Number.isFinite(until) && until > now) {
        return { blocked: true as const, retryAfter: Math.ceil((until - now) / 1000) };
      }
    }
    return { blocked: false as const };
  }

  const until = memoryDenylist.get(identifier);
  if (until && until > now) {
    return { blocked: true as const, retryAfter: Math.ceil((until - now) / 1000) };
  }

  return { blocked: false as const };
}

async function registerDenylist(redis: Redis | null, identifier: string) {
  const now = Date.now();
  const baseKey = `deny:${identifier}`;

  if (redis) {
    const count = await redis.incr(`${baseKey}:count`);
    const duration = Math.min(MAX_BLOCK_MS, BASE_BLOCK_MS * 2 ** Math.max(0, count - 1));
    const until = now + duration;
    await redis.set(`${baseKey}:until`, String(until), "PX", duration);
    await redis.pexpire(`${baseKey}:count`, 24 * 3600 * 1000);
    return { until, duration };
  }

  const currentCount = (memoryDenyCounts.get(identifier) ?? 0) + 1;
  memoryDenyCounts.set(identifier, currentCount);
  const duration = Math.min(MAX_BLOCK_MS, BASE_BLOCK_MS * 2 ** Math.max(0, currentCount - 1));
  const until = now + duration;
  memoryDenylist.set(identifier, until);
  return { until, duration };
}

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs = DEFAULT_WINDOW_MS,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  if (!Number.isFinite(limit) || limit <= 0 || options.bypass) {
    return { success: true, remaining: limit, reset: resolveNow(options.now) + windowMs, limit };
  }

  const redis = await ensureRedisClient();
  const deny = await isDenylisted(redis, identifier);
  if (deny.blocked) {
    return {
      success: false,
      remaining: 0,
      reset: resolveNow(options.now) + windowMs,
      retryAfter: deny.retryAfter,
      blocked: true,
      limit,
    };
  }

  let result: RateLimitResult;
  if (redis) {
    result = await consumeRedisBucket(redis, identifier, limit, { ...options, windowMs });
  } else {
    result = consumeMemoryBucket(identifier, limit, { ...options, windowMs });
  }

  if (!result.success) {
    const abuse = await registerDenylist(redis, identifier);
    result.retryAfter = Math.ceil(abuse.duration / 1000);
    result.blocked = true;
  }

  return result;
}

export function parseRateLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function resetRateLimits() {
  memoryBuckets.clear();
  memoryDenylist.clear();
  memoryDenyCounts.clear();
}

export function resolveRateLimitKey(request: Request, fallback = "anonymous") {
  const header =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip");

  if (!header) {
    return fallback;
  }

  return header.split(",")[0].trim() || fallback;
}

export function isRateLimitBypassed(request: Request) {
  const headerValue = request.headers.get("x-devlogia-internal") ?? "";
  if (headerValue && ["1", "true", "internal"].includes(headerValue.toLowerCase())) {
    return true;
  }

  if (allowlist.size === 0) {
    return false;
  }

  const ip = resolveRateLimitKey(request, "");
  if (!ip) {
    return false;
  }

  return allowlist.has(ip);
}

export function buildRateLimitHeaders(result: RateLimitResult, limit: number): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
    "X-RateLimit-Reset": String(result.reset),
  };

  if (!result.success && result.retryAfter !== undefined) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}

export function getRateLimitDiagnostics() {
  const client = getRedis();
  return {
    provider: client ? "redis" : "memory",
    lastError: getRedisLastError()?.message ?? null,
  };
}
