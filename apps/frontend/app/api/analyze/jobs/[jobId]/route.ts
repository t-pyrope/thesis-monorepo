import { NextRequest } from "next/server";
import { remoteJob } from "@/lib/backend/event-driven";

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return remoteJob(request, jobId, false);
}
