import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__Host-app-session";
export const SESSION_DURATION = 8 * 60 * 60;
export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION;
  const payload = `${expires}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(token: string | undefined) {
  if (!token || !/^\d{10}\.[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(token)) {
    return false;
  }
  const [expires, nonce, signature] = token.split(".");
  const now = Math.floor(Date.now() / 1000);
  if (Number(expires) <= now || Number(expires) > now + SESSION_DURATION) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(sign(`${expires}.${nonce}`)),
  );
}
