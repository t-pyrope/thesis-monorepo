import { NextRequest, NextResponse } from "next/server";
import { getBackend, backendCookieName } from "./config";
import { SESSION_COOKIE } from "@/lib/session";

export async function remoteJob(request: NextRequest, jobId: string, result = false) {
  const backend = getBackend();
  if (backend.mode !== "event-driven" || !/^[a-f0-9-]{36}$/.test(jobId))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const token = request.cookies.get(backendCookieName(backend.mode))?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const upstream = await fetch(`${backend.url}/jobs/${jobId}${result ? "/result" : ""}`, {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` }, cache: "no-store", redirect: "error",
      signal: request.signal,
    });
    return new NextResponse(upstream.body, { status: upstream.status, headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "private, no-store",
    } });
  } catch {
    return NextResponse.json({ error: "Backend is unavailable" }, { status: 502 });
  }
}
