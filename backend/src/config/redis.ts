import { Redis } from "ioredis";
import { env } from "./env.js";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times: number): number | null {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});
