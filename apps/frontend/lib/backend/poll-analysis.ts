export const POLL_INTERVAL_MS = 2000;

export class AnalysisHttpError extends Error {
  constructor(public status: number) { super(`Analysis request failed (HTTP ${status})`); }
}

// Fixed cadence; slow requests skip ticks. Aborting only stops client requests.
export function pollAnalysis(
  jobId: string,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  fetcher: typeof fetch = fetch,
  intervalMs = POLL_INTERVAL_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let busy = false;
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => { stop(); reject(new DOMException("Polling stopped", "AbortError")); };
    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const response = await fetcher(`/api/analyze/jobs/${encodeURIComponent(jobId)}`, { signal, cache: "no-store" });
        if (!response.ok) throw new AnalysisHttpError(response.status);
        const { status } = await response.json();
        if (stopped || signal.aborted) return;
        if (!["queued", "running", "completed", "failed"].includes(status)) throw new Error("Invalid analysis status");
        onStatus(status);
        if (status === "failed") throw new Error("Analysis failed");
        if (status === "completed") {
          const result = await fetcher(`/api/analyze/jobs/${encodeURIComponent(jobId)}/result`, { signal, cache: "no-store" });
          if (result.status !== 200) throw new AnalysisHttpError(result.status);
          const body = await result.json();
          if (stopped || signal.aborted) return;
          stop();
          resolve(body);
        }
      } catch (error) {
        if (!stopped) { stop(); reject(error); }
      } finally { busy = false; }
    };
    const timer = setInterval(() => { void tick(); }, intervalMs);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    void tick();
  });
}
