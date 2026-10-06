import { allowedOrigins } from './http.js';

export function validateEnvironment(): void {
  const required = ['OPENAI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SESSION_SECRET', 'APP_PASSWORD_HASH'];
  const missing = required.filter(key => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
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
