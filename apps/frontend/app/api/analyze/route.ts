import { NextRequest } from "next/server";
import { getBackend } from "@/lib/backend/config";
import { remoteAnalyze } from "@/lib/backend/remote";

export async function POST(request: NextRequest) {
  if (getBackend().mode !== "serverless") return remoteAnalyze(request);
  const { POST } = await import("@/lib/backend/serverless-analyze");
  return POST(request);
}
