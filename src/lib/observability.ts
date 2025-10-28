import { initRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

let initialized = false;

export function initObservability() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (process.env.RATE_LIMIT_REDIS_URL) {
    void initRedis().catch((error) => {
      logger.warn({ err: error }, "Failed to warm Redis connection");
    });
  }
}
