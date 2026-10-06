import { allowedOrigins } from './http.js';

export function validateEnvironment(role: "api" | "worker" = "api"): void {
  const required = ['REDIS_URL', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'SESSION_SECRET', 'APP_PASSWORD_HASH', ...(role === 'api' ? ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] : ['OPENAI_API_KEY'])];
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  const redis = new URL(process.env.REDIS_URL!);
  if (!['redis:', 'rediss:'].includes(redis.protocol)) throw new Error('REDIS_URL must use redis:// or rediss://');
  if (process.env.S3_ENDPOINT && new URL(process.env.S3_ENDPOINT).protocol !== 'https:') throw new Error('S3_ENDPOINT must use HTTPS');
  if (process.env.SESSION_SECRET!.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(process.env.APP_PASSWORD_HASH!.replace(/\\\$/g, '$'))) {
    throw new Error('APP_PASSWORD_HASH must be a bcrypt hash');
  }
  if (!['lax', 'none'].includes(process.env.COOKIE_SAME_SITE ?? 'lax')) throw new Error('COOKIE_SAME_SITE must be lax or none');
  const origins = allowedOrigins();
  if (process.env.COOKIE_SAME_SITE === 'none' && !origins.size) {
    throw new Error('Cross-site cookies require ALLOWED_ORIGINS');
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
}
