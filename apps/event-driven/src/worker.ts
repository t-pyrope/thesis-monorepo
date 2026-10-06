import 'dotenv/config';
import { Worker } from 'bullmq';
import { validateEnvironment } from './config.js';
import { QUEUE_NAME, EVENT_NAME, redisConnection, createQueue, type AnalysisRequested } from './jobs.js';
import { createObjectStore } from './storage.js';
import { createProcessor } from './process-analysis.js';
import { measureJob } from './instrumentation/jobs.js';
import { logAnalysisError } from './instrumentation/analysis.js';

validateEnvironment('worker');
const queue = createQueue();
// Also cap the queue globally, including during overlapping Render deploys.
await queue.setGlobalConcurrency(1);
const processAnalysis = createProcessor(createObjectStore());
const worker = new Worker<AnalysisRequested>(QUEUE_NAME, job => measureJob(job, async () => {
  if (job.name !== EVENT_NAME) throw new Error('Unsupported event');
  return processAnalysis(job);
}), { connection: redisConnection(), concurrency: 1, maxStalledCount: 0 });
worker.on('error', error => logAnalysisError('analysis.worker.error', error));
worker.on('failed', (job, error) => logAnalysisError('analysis.job.failed', error));

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void worker.close().then(() => queue.close()).then(() => process.exit(0));
  });
}
