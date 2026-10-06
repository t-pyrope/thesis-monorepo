import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Queue } from 'bullmq';
import { hash } from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createSession, SESSION_COOKIE } from '../src/session.js';
import { DOCUMENTS } from '../src/documents.js';
import { createProcessor } from '../src/process-analysis.js';
import { resultKey, EVENT_NAME, type AnalysisRequested } from '../src/jobs.js';
import type { ObjectStore } from '../src/storage.js';
import type { CheckResult } from '../src/types.js';

process.env.SESSION_SECRET = 'test-secret-with-at-least-32-characters';
const pdf = { pageSize: { valid: true, message: 'ok' } } as CheckResult['pdf'];
const ai = { violations: [], impossibleToDetermine: [], summary: 'summary', questions: ['question'] };

test('authenticated upload → queue → processing → result; failures and ownership', async () => {
  const objects = new Map<string, Uint8Array>();
  const store: ObjectStore = {
    async put(key, body) { objects.set(key, body); },
    async get(key) { const body = objects.get(key); if (!body) throw new Error('Missing object'); return body; },
  };
  const jobs = new Map<string, { id: string; data: AnalysisRequested; state: string; getState(): Promise<string> }>();
  let publicationFails = false;
  const queue = {
    async add(name: string, data: AnalysisRequested, options: { jobId: string; attempts: number }) {
      if (publicationFails) throw new Error('Redis unavailable');
      assert.equal(name, EVENT_NAME);
      assert.equal(options.attempts, 1);
      assert.deepEqual(Object.keys(data).sort(), ['manifestKey', 'owner']);
      assert.ok(objects.has(data.manifestKey));
      const job = { id: options.jobId, data, state: 'waiting', async getState() { return this.state; } };
      jobs.set(job.id, job); return job;
    },
    async getJob(id: string) { return jobs.get(id); },
  } as unknown as Queue<AnalysisRequested>;
  process.env.APP_PASSWORD_HASH = await hash('test-password', 4);
  process.env.TRUST_PROXY = 'true';
  const server = createApp(queue, store, async () => true).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const cookie = `${SESSION_COOKIE}=${createSession()}`;
  const headers = { Cookie: cookie };
  const upload = () => {
    const body = new FormData();
    body.set('rules', DOCUMENTS[0].profile_id);
    body.set('assignment', 'assignment\r\nsecond line');
    body.append('documents', new File(['test-pdf'], 'work.pdf', { type: 'application/pdf' }));
    return body;
  };
  try {
    const denied = await fetch(`${base}/analyze`, { method: 'POST', body: upload() });
    assert.equal(denied.status, 401);
    assert.equal((await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) })).status, 401);
    const login = await fetch(`${base}/login`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https',
    }, body: JSON.stringify({ password: 'test-password' }) });
    assert.equal(login.status, 204);
    assert.match(login.headers.get('set-cookie')!, /__Host-app-session=.*;.*secure/i);
    const response = await fetch(`${base}/analyze`, { method: 'POST', headers, body: upload() });
    assert.equal(response.status, 202);
    const { jobId } = await response.json() as { jobId: string };
    const job = jobs.get(jobId)!;
    const status = async () => (await (await fetch(`${base}/jobs/${jobId}`, { headers })).json() as { status: string }).status;
    assert.equal(await status(), 'queued');
    assert.equal((await fetch(`${base}/jobs/${jobId}/result`, { headers })).status, 202);
    const other = { Cookie: `${SESSION_COOKIE}=${createSession()}` };
    for (const suffix of ['', '/result']) {
      assert.equal((await fetch(`${base}/jobs/${jobId}${suffix}`, { headers: other })).status, 404);
      assert.equal((await fetch(`${base}/jobs/${jobId}${suffix}`)).status, 401);
    }
    job.state = 'active';
    assert.equal(await status(), 'running');
    await createProcessor(store, {
      async analyzePdf(file) { assert.equal(await file.text(), 'test-pdf'); return pdf; },
      async analyzeDocuments(files, profile, assignment) {
        assert.equal(files[0].name, 'work.pdf');
        assert.equal(profile.profile_id, DOCUMENTS[0].profile_id);
        assert.equal(assignment, 'assignment\nsecond line'); return ai;
      },
    })(job);
    job.state = 'completed';
    assert.equal(await status(), 'completed');
    const result = await fetch(`${base}/jobs/${jobId}/result`, { headers });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('cache-control')!, /no-store/);
    assert.deepEqual(await result.json(), { 'work.pdf': { pdf, ai } });
    objects.delete(resultKey(jobId));
    await assert.rejects(createProcessor(store, {
      async analyzePdf() { throw new Error('Invalid PDF'); },
      async analyzeDocuments() { throw new Error('Should not run'); },
    })(job), /Invalid PDF/);
    job.state = 'failed';
    assert.equal(await status(), 'failed');
    assert.equal(objects.has(resultKey(jobId)), false);
    assert.equal((await fetch(`${base}/jobs/${jobId}/result`, { headers })).status, 409);
    const invalid = upload(); invalid.set('rules', 'unknown');
    assert.equal((await fetch(`${base}/analyze`, { method: 'POST', headers, body: invalid })).status, 403);
    assert.equal((await fetch(`${base}/analyze`, { method: 'POST', headers, body: 'invalid' })).status, 400);
    publicationFails = true;
    assert.equal((await fetch(`${base}/analyze`, { method: 'POST', headers, body: upload() })).status, 503);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
