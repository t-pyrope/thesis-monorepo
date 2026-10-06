import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";
import { getBackend, backendCookieName } from "@/lib/backend/config";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path === "/api/login") {
    return NextResponse.next();
  }
  const backend = getBackend();
  const authenticated =
    backend.mode === "serverless"
      ? isValidSession(request.cookies.get(SESSION_COOKIE)?.value)
      : !!request.cookies.get(backendCookieName(backend.mode))?.value;
  // Remote backend validates its own signature on /analyze; this is only a page guard.
  if (!authenticated) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image|favicon.ico$).*)"],
};
