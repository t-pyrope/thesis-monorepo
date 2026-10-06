import type { Middleware } from 'koa';

export function allowedOrigins(): Set<string> {
  const entries = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return new Set(entries.map((value, index) => {
    const invalid = () => new Error(
      `ALLOWED_ORIGINS entry ${index + 1} must be an HTTP(S) origin, e.g. https://frontend.example.com (no path, query, fragment, credentials or wildcard)`,
    );
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw invalid();
    }
    if (!/^https?:\/\/[^/?#\\\s]+\/?$/i.test(value) ||
        !['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' ||
        url.search || url.hash || url.username || url.password || url.hostname.includes('*')) {
      throw invalid();
    }
    // Browsers send canonical origins without a trailing slash or default port.
    return url.origin;
  }));
}

export function isAllowedOrigin(origin: string, ownOrigin: string): boolean {
  return origin === ownOrigin || allowedOrigins().has(origin);
}

// Check actual requests too: HTML forms can bypass a CORS preflight.
export const browserAccess: Middleware = async (ctx, next) => {
  const origin = ctx.get('Origin');
  ctx.vary('Origin');
  if (origin) {
    if (!isAllowedOrigin(origin, ctx.origin)) {
      ctx.status = 403;
      ctx.body = { error: 'Forbidden origin' };
      return;
    }
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Credentials', 'true');
    if (ctx.method === 'OPTIONS') {
      ctx.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      ctx.set('Access-Control-Allow-Headers', 'Content-Type');
      ctx.status = 204;
      return;
    }
  }
  await next();
};
