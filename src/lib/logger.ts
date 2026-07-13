import pino from "pino";

import logtailTransport from "@/lib/logtail-transport";

const service = process.env.LOG_SERVICE_NAME ?? "devlogia";
const environment = process.env.NODE_ENV ?? "development";
const level =
  process.env.LOG_LEVEL ?? (environment === "production" ? "info" : "debug");

const logtailToken = process.env.LOGTAIL_TOKEN;

const options = {
  level,
  base: { service, environment },
  timestamp: () => `,"ts":"${new Date().toISOString()}"`,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
};

// Use the custom destination directly so bundled server code does not need to
// resolve a TypeScript path alias from Pino's worker thread at runtime.
export const logger =
  environment === "production" && logtailToken
    ? pino(options, logtailTransport({ token: logtailToken }))
    : pino(options);

export function createRequestLogger(context: {
  reqId: string;
  route?: string;
  method?: string;
  ip?: string;
}) {
  return logger.child(context);
}
