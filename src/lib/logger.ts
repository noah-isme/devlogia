import pino from "pino";

const service = process.env.LOG_SERVICE_NAME ?? "devlogia";
const environment = process.env.NODE_ENV ?? "development";
const level = process.env.LOG_LEVEL ?? (environment === "production" ? "info" : "debug");

const logtailToken = process.env.LOGTAIL_TOKEN;

const transport = (() => {
  if (environment === "production") {
    if (logtailToken) {
      return {
        target: "@/lib/logtail-transport",
        options: { token: logtailToken },
      } as const;
    }
    return undefined;
  }

  // Disable transport in development to avoid pino-pretty/thread-stream issues
  return undefined;
})();

export const logger = pino({
  level,
  base: { service, environment },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport,
});

export function createRequestLogger(context: { reqId: string; route?: string; method?: string; ip?: string }) {
  return logger.child(context);
}
