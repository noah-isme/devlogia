const buckets = new Map<string, { count: number; expiresAt: number }>();

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket || bucket.expiresAt <= now) {
    const expiresAt = now + windowMs;
    buckets.set(identifier, { count: 1, expiresAt });
    return { success: true, remaining: Math.max(0, limit - 1), reset: expiresAt };
  }

  if (bucket.count >= limit) {
    return { success: false, remaining: 0, reset: bucket.expiresAt };
  }

  bucket.count += 1;
  buckets.set(identifier, bucket);
  return { success: true, remaining: Math.max(0, limit - bucket.count), reset: bucket.expiresAt };
}

export function parseRateLimit(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function resetRateLimits() {
  buckets.clear();
}
