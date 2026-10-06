import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { createProcessor } from '../src/process-analysis.js';
import { redisConnection, EVENT_NAME, resultKey, type AnalysisRequested } from '../src/jobs.js';
import { putJson, getJson, type ObjectStore } from '../src/storage.js';
import { DOCUMENTS } from '../src/documents.js';
import type { CheckResult } from '../src/types.js';
import { measureJob } from '../src/instrumentation/jobs.js';

test('real Redis/BullMQ completes or fails exactly once, serially', {
  skip: !process.env.TEST_REDIS_URL,
  timeout: 20000,
}, async () => {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  const name = `test-analysis-${randomUUID()}`;
  const connection = redisConnection();
  const queue = new Queue<AnalysisRequested>(name, { connection, defaultJobOptions: { attempts: 1 } });
  const events = new QueueEvents(name, { connection });
  const objects = new Map<string, Uint8Array>();
  const store: ObjectStore = {
    async put(key, body) { objects.set(key, body); },
    async get(key) { const body = objects.get(key); if (!body) throw new Error('Missing object'); return body; },
  };
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  const processor = createProcessor(store, {
    async analyzePdf(file) {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 25));
      if (file.name === 'broken.pdf') throw new Error('Invalid PDF');
      return {} as CheckResult['pdf'];
    },
    async analyzeDocuments() { return { violations: [], impossibleToDetermine: [], summary: 'ok', questions: [] }; },
  });
  await queue.setGlobalConcurrency(1);
  const worker = new Worker<AnalysisRequested>(name, job => measureJob(job, async () => {
    active++; maxActive = Math.max(maxActive, active);
    try { return await processor(job); } finally { active--; }
  }), { connection, concurrency: 1, maxStalledCount: 0 });
  try {
    await events.waitUntilReady();
    const makeJob = async (filename: string) => {
      const id = randomUUID();
      const key = `analyses/${id}/document`;
      const manifestKey = `analyses/${id}/manifest.json`;
      await store.put(key, Buffer.from('document'), 'application/pdf');
      await putJson(store, manifestKey, { rules: DOCUMENTS[0].profile_id, assignment: '', documents: [{ key, name: filename, type: 'application/pdf' }] });
      return queue.add(EVENT_NAME, { owner: 'test-owner', manifestKey }, { jobId: id, attempts: 1 });
    };
    const successful = await makeJob('work.pdf');
    const broken = await makeJob('broken.pdf');
    const failure = assert.rejects(broken.waitUntilFinished(events, 10000), /Invalid PDF/);
    await successful.waitUntilFinished(events, 10000);
    assert.equal(await successful.getState(), 'completed');
    assert.ok((await getJson<Record<string, unknown>>(store, resultKey(successful.id!)))['work.pdf']);
    await failure;
    assert.equal(await broken.getState(), 'failed');
    const reloaded = await queue.getJob(broken.id!);
    assert.equal(reloaded!.attemptsMade, 1);
    assert.equal(objects.has(resultKey(broken.id!)), false);
    assert.equal(calls, 2);
    assert.equal(maxActive, 1);
  } finally {
    await worker.close();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
