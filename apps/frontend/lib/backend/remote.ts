import { NextRequest, NextResponse } from "next/server";
import { getBackend, backendCookieName } from "./config";
import {
  SESSION_COOKIE,
  SESSION_DURATION,
  sessionCookieOptions,
} from "@/lib/session";

export async function remoteLogin(request: NextRequest) {
  const backend = getBackend();
  const password = (await request.formData()).get("password");
  if (
    typeof password !== "string" ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
  try {
    const upstream = await fetch(`${backend.url}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      cache: "no-store",
      redirect: "error",
    });
    if (upstream.status === 401)
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    if (!upstream.ok)
      return new NextResponse("Backend login failed", { status: 502 });
    const cookie = upstream.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie?.split(";")[0].slice(SESSION_COOKIE.length + 1);
    if (!token)
      return new NextResponse("Backend did not issue a session", {
        status: 502,
      });
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(backendCookieName(backend.mode), token, {
      ...sessionCookieOptions,
      maxAge: SESSION_DURATION,
    });
    return response;
  } catch {
    return new NextResponse("Backend is unavailable", { status: 502 });
  }
}

export async function remoteAnalyze(request: NextRequest) {
  const backend = getBackend();
  const token = request.cookies.get(backendCookieName(backend.mode))?.value;
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const upstream = await fetch(`${backend.url}/analyze`, {
      method: "POST",
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      body: await request.formData(),
      cache: "no-store",
      redirect: "error",
    });
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of ["content-type", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend is unavailable" },
      { status: 502 },
    );
  }
}
