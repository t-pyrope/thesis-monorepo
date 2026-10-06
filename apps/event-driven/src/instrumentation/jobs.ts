// Observability is deliberately outside the processor's functional logic.
export async function measureJob<T>(
  job: { id?: string; timestamp: number }, work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const queueWaitMs = Math.max(0, Date.now() - job.timestamp);
  try {
    console.log(JSON.stringify({ event: 'analysis.job.start', jobId: job.id, queueWaitMs }));
  } catch { /* Metrics must not affect job state. */ }
  let success = false;
  try {
    const result = await work();
    success = true;
    return result;
  } finally {
    try {
      console.log(JSON.stringify({ event: 'analysis.job.end', jobId: job.id,
        queueWaitMs, processingMs: performance.now() - started, success }));
    } catch { /* Metrics must not affect job state. */ }
  }
}
