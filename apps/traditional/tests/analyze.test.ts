import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import type { Context } from 'koa';
import { createAnalyzeHandler } from '../src/analyze.js';
import { DOCUMENTS } from '../src/documents.js';
import type { CheckResult } from '../src/types.js';

async function context(files = ['one.pdf', 'two.pdf'], rules = DOCUMENTS[0].profile_id, assignment = 'Test\r\nassignment') {
  const form = new FormData();
  form.set('rules', rules);
  form.set('assignment', assignment);
  for (const name of files) form.append('documents', new File(['%PDF-test'], name, { type: 'application/pdf' }));
  const request = new Request('http://localhost/analyze', { method: 'POST', body: form });
  return { req: Readable.from([Buffer.from(await request.arrayBuffer())]), ip: '127.0.0.1',
    is: () => true, get: () => request.headers.get('content-type') } as unknown as Context;
}

test('analysis route processes multipart batches and records success and failure metrics', async (t) => {
  const logs: Record<string, unknown>[] = [];
  const originalLog = console.log;
  console.log = (value) => logs.push(JSON.parse(value));
  t.after(() => { console.log = originalLog; });
  const order: string[] = [];
  const pdf = {} as CheckResult['pdf'];
  const ai = { violations: [], impossibleToDetermine: [], summary: 'Summary', questions: [] };
  const deps = {
    rateLimit: async (key: string, limit: number, seconds: number) => {
      assert.equal(key, 'analyze:127.0.0.1'); assert.equal(limit, 10); assert.equal(seconds, 60); return true;
    },
    analyzePdf: async (file: File) => { order.push(`pdf:${file.name}`); return pdf; },
    analyzeDocuments: async (files: File[], profile: unknown, assignment: string = '') => {
      assert.equal(files.length, 1); assert.equal(profile, DOCUMENTS[0]);
      assert.equal(assignment, 'Test\nassignment'); order.push(`ai:${files[0].name}`); return ai;
    },
  };
  const run = async (ctx: Context, overrides = {}) => { await createAnalyzeHandler({ ...deps, ...overrides })(ctx, async () => {}); return ctx; };
  const ctx = await run(await context());
  assert.equal(ctx.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.body)), { 'one.pdf': { pdf, ai }, 'two.pdf': { pdf, ai } });
  assert.deepEqual(order, ['pdf:one.pdf', 'ai:one.pdf', 'pdf:two.pdf', 'ai:two.pdf']);
  const summaries = logs.filter(log => log.event === 'analysis.request.end');
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].requestId, summaries[1].requestId);
  assert.notEqual(summaries[0].analysisId, summaries[1].analysisId);
  assert.ok(summaries.every(log => log.success === true && log.httpStatus === 200));
  assert.equal((await run(await context([]))).status, 400);
  assert.equal((await run(await context(['same.pdf', 'same.pdf']))).status, 400);
  assert.equal((await run(await context(['one.pdf'], 'unknown'))).status, 403);
  assert.equal((await run(await context(['one.pdf'], DOCUMENTS[0].profile_id, 'a'.repeat(5001)))).status, 400);
  assert.equal((await run(await context(), { rateLimit: async () => false })).status, 429);
  assert.equal((await run(await context(), { analyzeDocuments: async () => { throw new Error('Provider failure'); } })).status, 500);
  assert.equal(logs.at(-1)?.success, false);
  assert.ok(logs.some(log => log.event === 'analysis.request.error'));
  assert.equal((await run({ ip: '127.0.0.1', is: () => false } as unknown as Context)).status, 400);
});

test('OpenAI metrics include SDK operations, payload sizes and HTTP status', async (t) => {
  const { measureAnalysisRequest, measureOpenAICall } = await import('../src/instrumentation/analysis.js');
  const logs: Record<string, unknown>[] = [];
  const originalLog = console.log;
  console.log = value => logs.push(JSON.parse(value));
  t.after(() => { console.log = originalLog; });
  await measureAnalysisRequest(async measureDocument => {
    await measureDocument(async () => {
      const data = await measureOpenAICall('files.create', 42, () => ({
        withResponse: async () => ({ data: { id: 'file-test' }, response: new Response(null, { status: 201 }) }),
      }));
      assert.equal(data.id, 'file-test');
    });
    return { status: 200 };
  });
  const summary = logs.at(-1)!;
  assert.equal(summary.openaiCallCount, 1);
  assert.equal(summary.approximateBytesSent, 42);
  assert.equal(summary.approximateBytesReceived, Buffer.byteLength(JSON.stringify({ id: 'file-test' })));
  assert.ok(logs.some(log => log.event === 'analysis.openai.end' && log.httpStatus === 201));
});
