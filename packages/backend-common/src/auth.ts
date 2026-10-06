import { isAllowedOrigin } from './http.js';
import { compare } from 'bcryptjs';
import type { Middleware } from 'koa';
import {
  createSession,
  isValidSession,
  SESSION_COOKIE,
  SESSION_DURATION,
  sessionCookieOptions,
} from './session.js';

export const requireAuth: Middleware = async (ctx, next) => {
  if (!isValidSession(ctx.cookies.get(SESSION_COOKIE, { signed: false }))) {
    ctx.status = 401;
    ctx.body = 'Unauthorized';
    return;
  }
  ctx.set('Cache-Control', 'private, no-store');
  await next();
};

export const login: Middleware = async (ctx) => {
  ctx.set('Cache-Control', 'no-store');
  const origin = ctx.get('Origin');
  if (origin && !isAllowedOrigin(origin, ctx.origin)) {
    ctx.status = 403;
    ctx.body = 'Forbidden';
    return;
  }

  // Match the frontend's handling of escaped dollar signs in configured hashes.
  const hash = process.env.APP_PASSWORD_HASH?.replace(/\\\$/g, '$');
  if (!hash || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
    ctx.status = 503;
    ctx.body = 'Login is not configured';
    return;
  }
  const body: unknown = (ctx.request as typeof ctx.request & { body?: unknown }).body;
  const password = body && typeof body === 'object' && 'password' in body
    ? body.password
    : undefined;
  if (
    typeof password !== 'string' ||
    !password ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !(await compare(password, hash))
  ) {
    ctx.status = 401;
    ctx.body = 'Unauthorized';
    return;
  }

  ctx.cookies.set(SESSION_COOKIE, createSession(), {
    ...sessionCookieOptions,
    sameSite: process.env.COOKIE_SAME_SITE === 'none' ? 'none' : 'lax',
    maxAge: SESSION_DURATION * 1000,
  });
  ctx.status = 204;
};
