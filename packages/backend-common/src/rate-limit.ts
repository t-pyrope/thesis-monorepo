import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Each application controls Redis initialization while sharing the limiter logic.
export function createRateLimit(redis?: Redis) {
  const ratelimiterCache = new Map<string, Ratelimit>();

  const getRatelimiter = (limit: number, windowSec: number) => {
    const cacheKey = `${limit}:${windowSec}`;
    const existing = ratelimiterCache.get(cacheKey);

    if (existing) {
      return existing;
    }

    const ratelimiter = new Ratelimit({
      redis: redis ??= Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "ratelimit",
    });

    ratelimiterCache.set(cacheKey, ratelimiter);

    return ratelimiter;
  };

  return async (key: string, limit = 5, windowSec = 60) => {
    const { success } = await getRatelimiter(limit, windowSec).limit(key);

    return success;
  };
}

// Backend clients remain lazy, as before extraction.
export const rateLimit = createRateLimit();
