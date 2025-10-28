import Redis from "ioredis";

import { logger } from "@/lib/logger";

type RedisClient = Redis | null;

let client: RedisClient = null;
let initializing: Promise<RedisClient> | null = null;
let lastError: Error | null = null;

function getRedisUrl() {
  return process.env.RATE_LIMIT_REDIS_URL ?? process.env.REDIS_URL ?? "";
}

function createClient(url: string) {
  const instance = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
    reconnectOnError: (err) => {
      logger.warn({ err }, "Redis reconnect requested");
      return true;
    },
  });

  instance.on("error", (error) => {
    lastError = error instanceof Error ? error : new Error(String(error));
    logger.error({ err: lastError }, "Redis connection error");
  });

  instance.on("end", () => {
    logger.warn({ component: "redis" }, "Redis connection closed");
  });

  return instance;
}

export async function initRedis(): Promise<RedisClient> {
  if (client) {
    return client;
  }

  const url = getRedisUrl();
  if (!url) {
    return null;
  }

  if (!initializing) {
    initializing = (async () => {
      const instance = createClient(url);
      try {
        await instance.connect();
        client = instance;
        lastError = null;
        logger.info({ component: "redis" }, "Redis connected");
        return client;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error({ err: lastError }, "Failed to connect to Redis");
        instance.disconnect();
        client = null;
        return null;
      } finally {
        initializing = null;
      }
    })();
  }

  return initializing;
}

export function getRedis(): RedisClient {
  return client;
}

export function getRedisLastError(): Error | null {
  return lastError;
}

export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}
