import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/lib/backend/config";
import { remoteLogin } from "@/lib/backend/remote";
import {
  createSession,
  SESSION_COOKIE,
  SESSION_DURATION,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (getBackend().mode !== "serverless") return remoteLogin(request);
  // Hosting dashboards may preserve the dollar escaping used in .env files.
  const hash = process.env.APP_PASSWORD_HASH?.replace(/\\\$/g, "$");
  if (!hash || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
    return new NextResponse("Login is not configured", { status: 503 });
  }
  const form = await request.formData();
  const password = form.get("password");
  if (
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72 ||
    !(await compare(password, hash))
  ) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, createSession(), {
    ...sessionCookieOptions,
    maxAge: SESSION_DURATION,
  });
  return response;
}
