import { NextRequest, NextResponse } from "next/server";
import { getBackend, backendCookieName } from "@/lib/backend/config";
import {
  isValidSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const backend = getBackend();
  const cookieName =
    backend.mode === "serverless"
      ? SESSION_COOKIE
      : backendCookieName(backend.mode);
  if (
    backend.mode === "serverless" &&
    !isValidSession(request.cookies.get(cookieName)?.value)
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(cookieName, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
