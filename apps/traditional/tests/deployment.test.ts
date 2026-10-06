import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Context } from 'koa';
import { allowedOrigins, browserAccess } from '../src/http.js';
import { validateEnvironment } from '../src/config.js';
import { login } from '../src/auth.js';
import { hash } from 'bcryptjs';

test('deployment configuration and credentialed browser requests', async (t) => {
  const keys = ['OPENAI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'SESSION_SECRET', 'APP_PASSWORD_HASH', 'ALLOWED_ORIGINS', 'COOKIE_SAME_SITE', 'PORT'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, {
    OPENAI_API_KEY: 'test', UPSTASH_REDIS_REST_URL: 'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN: 'test',
    SESSION_SECRET: 'test-secret-with-at-least-32-characters', APP_PASSWORD_HASH: await hash('password', 4),
    ALLOWED_ORIGINS: ' https://FRONTEND.example.com:443/ , http://localhost:3001/ ', COOKIE_SAME_SITE: 'none', PORT: '3000',
  });
  assert.doesNotThrow(validateEnvironment);
  assert.deepEqual([...allowedOrigins()], ['https://frontend.example.com', 'http://localhost:3001']);
  for (const method of ['POST', 'OPTIONS']) {
    for (const origin of ['https://frontend.example.com', 'https://untrusted.example.com']) {
      const headers = new Map<string, string>();
      let called = false;
      const ctx = { method, origin: 'https://backend.example.com', get: () => origin, vary() {},
        set: (key: string, value: string) => headers.set(key, value) } as unknown as Context;
      await browserAccess(ctx, async () => { called = true; });
      const allowed = origin === 'https://frontend.example.com';
      assert.equal(called, allowed && method === 'POST');
      assert.equal(headers.get('Access-Control-Allow-Origin'), allowed ? origin : undefined);
      if (!allowed) assert.equal(ctx.status, 403);
      if (allowed && method === 'OPTIONS') assert.equal(ctx.status, 204);
    }
  }
  let cookieOptions: Record<string, unknown> | undefined;
  const ctx = { origin: 'https://backend.example.com', get: () => 'https://frontend.example.com', set() {},
    request: { body: { password: 'password' } },
    cookies: { set: (_name: string, _value: string, options: Record<string, unknown>) => { cookieOptions = options; } },
  } as unknown as Context;
  await login(ctx, async () => {});
  assert.equal(ctx.status, 204);
  assert.equal(cookieOptions?.sameSite, 'none');
  assert.equal(cookieOptions?.secure, true);
  for (const invalid of ['*', 'https://*.example.com', 'frontend.example.com', 'https://frontend.example.com/path',
    'https://frontend.example.com?x=1', 'https://frontend.example.com#fragment',
    'https://user:pass@frontend.example.com', 'ftp://frontend.example.com', 'https://frontend.example.com/../']) {
    process.env.ALLOWED_ORIGINS = invalid;
    assert.throws(validateEnvironment, /ALLOWED_ORIGINS entry 1/);
  }
  process.env.ALLOWED_ORIGINS = '';
  assert.throws(validateEnvironment, /ALLOWED_ORIGINS/);
  process.env.COOKIE_SAME_SITE = 'lax';
  delete process.env.OPENAI_API_KEY;
  assert.throws(validateEnvironment, /OPENAI_API_KEY/);
});
