import { Redis } from "@upstash/redis";
import { createRateLimit } from "@academic-analyzer/backend-common/rate-limit";

// Preserve the serverless client's existing eager Redis initialization.
export const rateLimit = createRateLimit(Redis.fromEnv());
