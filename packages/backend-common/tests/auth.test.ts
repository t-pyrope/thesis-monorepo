import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { hash } from 'bcryptjs';
import type { Context } from 'koa';
import { login, requireAuth } from '../src/auth.js';
import { createSession, isValidSession, SESSION_COOKIE, SESSION_DURATION } from '../src/session.js';

test('session authentication', async (t) => {
  const originalSecret = process.env.SESSION_SECRET;
  const originalHash = process.env.APP_PASSWORD_HASH;
  process.env.SESSION_SECRET = 'test-secret-with-at-least-32-characters';
  process.env.APP_PASSWORD_HASH = await hash('correct-password', 4);
  t.after(() => {
    for (const [key, value] of Object.entries({ SESSION_SECRET: originalSecret, APP_PASSWORD_HASH: originalHash })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await t.test('matches the frontend wire format and rejects tampering and expiry', () => {
    const token = createSession();
    assert.match(token, /^\d{10}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/);
    assert.equal(isValidSession(token), true);
    assert.notEqual(token, createSession());
    const [expires, nonce, signature] = token.split('.');
    assert.equal(signature, createHmac('sha256', process.env.SESSION_SECRET!).update(`${expires}.${nonce}`).digest('base64url'));
    const now = Math.floor(Date.now() / 1000);
    assert.ok(Number(expires) >= now + SESSION_DURATION - 1);
    const signed = (timestamp: number) => {
      const payload = `${timestamp}.${nonce}`;
      return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('base64url')}`;
    };
    for (const invalid of [undefined, '', 'bad', `${expires}.${nonce}.${'A'.repeat(43)}`, signed(now), signed(now - 1), signed(now + SESSION_DURATION + 60)]) {
      assert.equal(isValidSession(invalid), false);
    }
    process.env.SESSION_SECRET = 'another-secret-with-at-least-32-characters';
    assert.equal(isValidSession(token), false);
    process.env.SESSION_SECRET = 'test-secret-with-at-least-32-characters';
  });

  await t.test('middleware blocks invalid sessions and allows valid sessions', async () => {
    for (const token of [undefined, 'invalid', createSession()]) {
      let called = false;
      const ctx = { cookies: { get: (name: string) => { assert.equal(name, SESSION_COOKIE); return token; } }, set() {} } as unknown as Context;
      await requireAuth(ctx, async () => { called = true; });
      assert.equal(called, isValidSession(token));
      if (!called) {
        assert.equal(ctx.status, 401);
        assert.equal(ctx.body, 'Unauthorized');
      }
    }
  });

  await t.test('login verifies passwords and sets the secure eight-hour cookie', async () => {
    for (const password of [undefined, '', 123, 'wrong', 'a'.repeat(73), 'correct-password']) {
      let cookieSet = false;
      const ctx = {
        request: { body: { password } }, get: () => '', set() {},
        cookies: { set(name: string, token: string, options: object) {
          cookieSet = true;
          assert.equal(name, SESSION_COOKIE);
          assert.equal(isValidSession(token), true);
          assert.deepEqual(options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', signed: false, maxAge: 28800000 });
        } },
      } as unknown as Context;
      await login(ctx, async () => {});
      assert.equal(ctx.status, password === 'correct-password' ? 204 : 401);
      assert.equal(cookieSet, password === 'correct-password');
    }
  });
});
