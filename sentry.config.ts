type Runtime = "client" | "server" | "edge";

function parseFloatEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createSentryOptions(runtime: Runtime) {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
  const enabled = Boolean(dsn && process.env.NODE_ENV !== "test");
  const release =
    process.env.SENTRY_RELEASE ??
    process.env.NEXT_PUBLIC_GIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    undefined;

  const tracesFallback = runtime === "client" ? 0.05 : 0.1;
  const profilesFallback = runtime === "server" ? 0.02 : 0;

  return {
    dsn: dsn || undefined,
    enabled,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release,
    tracesSampleRate: parseFloatEnv("SENTRY_TRACES_SAMPLE_RATE", tracesFallback),
    profilesSampleRate: parseFloatEnv("SENTRY_PROFILES_SAMPLE_RATE", profilesFallback),
    debug: process.env.SENTRY_DEBUG === "true",
    autoInstrumentations: {
      http: true,
      mongodb: false,
      pg: false,
      prisma: true,
      redis: true,
    },
    initialScope: {
      tags: { runtime },
    },
  };
}
