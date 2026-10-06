/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/backend/poll-analysis.ts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { pollAnalysis, AnalysisHttpError } = loaded.exports;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('queued/running/completed → original result, slow requests never overlap and stop', async () => {
  let active = 0, maxActive = 0, calls = 0;
  const statuses = [], expected = { 'work.pdf': { pdf: {}, ai: { summary: 'ok' } } };
  const result = await pollAnalysis('job-id', new AbortController().signal, status => statuses.push(status), async url => {
    active++; maxActive = Math.max(maxActive, active); calls++;
    await delay(15);
    active--;
    if (url.endsWith('/result')) return Response.json(expected);
    return Response.json({ status: ['queued', 'running', 'completed'][calls - 1] });
  }, 5);
  assert.deepEqual(result, expected);
  assert.deepEqual(statuses, ['queued', 'running', 'completed']);
  assert.equal(maxActive, 1);
  assert.equal(calls, 4);
  await delay(20);
  assert.equal(calls, 4);
});

test('failed job stops without fetching a result', async () => {
  let calls = 0;
  await assert.rejects(pollAnalysis('id', new AbortController().signal, () => {}, async () => {
    calls++; return Response.json({ status: 'failed' });
  }, 5), /Analysis failed/);
  await delay(15); assert.equal(calls, 1);
});

test('unmount abort stops a pending request without cancelling the server job', async () => {
  let calls = 0, observedAbort = false;
  const controller = new AbortController();
  const pending = pollAnalysis('id', controller.signal, () => {}, async (url, options) => {
    calls++;
    assert.equal(options.signal, controller.signal);
    assert.ok(!url.includes('cancel'));
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => {
      observedAbort = true; reject(new DOMException('aborted', 'AbortError'));
    }, { once: true }));
  }, 5);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await delay(10); controller.abort(); await rejected;
  await delay(15);
  assert.equal(calls, 1); assert.equal(observedAbort, true);
});

for (const status of [401, 404, 503]) {
  test(`HTTP ${status} stops polling`, async () => {
    let calls = 0;
    await assert.rejects(pollAnalysis('id', new AbortController().signal, () => {}, async () => {
      calls++; return new Response('', { status });
    }, 5), error => error instanceof AnalysisHttpError && error.status === status);
    await delay(15); assert.equal(calls, 1);
  });
}
