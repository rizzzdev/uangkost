import { Redis } from "ioredis";
import { env } from "./env.js";

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

export const redis: Redis =
  globalThis.__redisClient ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times: number): number | null {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

if (env.NODE_ENV !== "production") {
  globalThis.__redisClient = redis;
}

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

redis.on("connect", () => {
  console.log("Redis connected");
});
