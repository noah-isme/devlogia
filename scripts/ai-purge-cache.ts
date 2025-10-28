import { initRedis } from "../src/lib/redis";

async function run() {
  const redis = await initRedis();
  if (!redis) {
    console.log("Redis is not configured. Nothing to purge.");
    return;
  }
  try {
    let cursor = "0";
    let removed = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "ai-cache:*", "COUNT", "500");
      cursor = nextCursor;
      if (keys.length) {
        removed += keys.length;
        await redis.del(...keys);
      }
    } while (cursor !== "0");
    console.log(`Removed ${removed} cached AI entries.`);
  } finally {
    await redis.quit();
  }
}

run().catch((error) => {
  console.error("Failed to purge AI cache", error);
  process.exitCode = 1;
});
