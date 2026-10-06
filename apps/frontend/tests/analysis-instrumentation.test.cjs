/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the real application modules without a Next server or API credentials.
function loadTs(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => overrides[id] ?? originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const instrumentation = loadTs('../../packages/analysis-core/src/instrumentation/analysis.ts');
const OpenAI = require('openai').default;
class TestOpenAI extends OpenAI {
  constructor() { super({ apiKey: 'test-only' }); }
}
const coreAi = loadTs('../../packages/analysis-core/src/ai.ts', {
  './instrumentation/analysis.js': instrumentation,
  openai: TestOpenAI,
});
const { analyzeDocuments, openai } = loadTs('lib/ai.ts', {
  '@academic-analyzer/analysis-core/ai': coreAi,
  '@/lib/instrumentation/analysis': instrumentation,
  openai: TestOpenAI,
});

async function capture(work) {
  const events = [];
  const originalLog = console.log;
  console.log = (line) => events.push(JSON.parse(line));
  try { await work(events); } finally { console.log = originalLog; }
}

test('real analysis call path logs each SDK operation and request completion', async () => {
  await capture(async (events) => {
    const calls = [];
    const result = { violations: [], impossibleToDetermine: [], summary: 'ok', questions: [] };
    openai.fetch = async (url) => {
      // The SDK probes fetch support using a local data URL before uploading.
      if (String(url) === 'data:,') return new Response('');
      calls.push(String(url));
      return Response.json(String(url).endsWith('/files') ? { id: 'file-test' } : {
        id: 'resp-test', object: 'response', output: [{ type: 'message', content: [
          { type: 'output_text', text: JSON.stringify(result), annotations: [] },
        ] }],
      });
    };
    const response = await instrumentation.measureAnalysisRequest(async (measureDocument) => {
      const actual = await measureDocument(() => instrumentation.measureAnalysisStage('ai.analyze',
        () => analyzeDocuments([new File(['document'], 'work.pdf')], { rules: [] })));
      assert.deepEqual(actual, result);
      return Response.json(actual);
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    const ends = events.filter((event) => event.event === 'analysis.openai.end');
    assert.deepEqual(ends.map((event) => event.operation), ['files.create', 'responses.create']);
    const requestEnd = events.at(-1);
    assert.equal(requestEnd.event, 'analysis.request.end');
    assert.equal(requestEnd.openaiCallCount, 2);
    assert.equal(requestEnd.success, true);
    for (const end of ends) {
      assert.equal(end.success, true);
      assert.equal(end.httpStatus, 200);
      assert.equal(end.requestId, requestEnd.requestId);
      assert.equal(end.analysisId, requestEnd.analysisId);
      assert.ok(events.some((start) => start.event === 'analysis.openai.start' && start.callId === end.callId));
    }
  });
});

test('failed SDK operation and rejected handler still emit end events', async () => {
  await capture(async (events) => {
    const failure = Object.assign(new Error('test failure'), { status: 400 });
    await assert.rejects(instrumentation.measureAnalysisRequest(async (measureDocument) => {
      await measureDocument(() => instrumentation.measureOpenAICall('responses.create', 10, () => ({
        withResponse: async () => { throw failure; },
      })));
      return Response.json({});
    }), (error) => error === failure);
    const end = events.find((event) => event.event === 'analysis.openai.end');
    assert.equal(end.httpStatus, 400);
    assert.equal(end.success, false);
    assert.equal(events.at(-1).event, 'analysis.request.end');
    assert.equal(events.at(-1).success, false);
  });
});

test('early returns and multiple completed documents receive request summaries', async () => {
  for (const status of [400, 403, 429, 500]) {
    await capture(async (events) => {
      await instrumentation.measureAnalysisRequest(async () => new Response(null, { status }));
      assert.equal(events.at(-1).event, 'analysis.request.end');
      assert.equal(events.at(-1).httpStatus, status);
      assert.equal(events.at(-1).openaiCallCount, 0);
    });
  }
  await capture(async (events) => {
    await instrumentation.measureAnalysisRequest(async (measureDocument) => {
      await measureDocument(async () => 'first');
      await measureDocument(async () => 'second');
      return Response.json({});
    });
    const ends = events.filter((event) => event.event === 'analysis.request.end');
    assert.equal(ends.length, 2);
    assert.ok(ends.every((event) => event.success));
    assert.notEqual(ends[0].analysisId, ends[1].analysisId);
  });
});

test('assignment reaches the AI request and API rejects oversized assignments', async () => {
  const constants = loadTs('../../packages/analysis-core/src/constants.ts');
  const validation = loadTs('../../packages/analysis-core/src/validation.ts', { './constants.js': constants });
  const result = { violations: [], impossibleToDetermine: [], summary: 'ok', questions: [] };
  const requests = [];
  openai.fetch = async (url, options) => {
    if (String(url) === 'data:,') return new Response('');
    if (String(url).endsWith('/files')) return Response.json({ id: 'file-test' });
    requests.push(JSON.parse(options.body));
    return Response.json({ id: 'resp-test', object: 'response', output: [
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result), annotations: [] }] },
    ] });
  };
  const { POST } = loadTs('lib/backend/serverless-analyze.ts', {
    '@/lib/session': { isValidSession: () => true, SESSION_COOKIE: '__Host-app-session' },
    '@/lib/rate-limit': { rateLimit: async () => true },
    '@/lib/validation': validation,
    '@/lib/ai': { analyzeDocuments },
    '@/lib/pdf/analyzePdf': { analyzePdf: async () => ({}) },
    '@/app/components/constants': { DOCUMENTS: [{ profile_id: 'test', rules: [], documentRules: [] }] },
    '@/lib/instrumentation/analysis': instrumentation,
  });
  await capture(async () => {
    for (const assignment of ['Cílem práce je vytvořit aplikaci.\nPorovnej výsledky.', '', 'a'.repeat(constants.MAX_ASSIGNMENT_LENGTH), 'a'.repeat(constants.MAX_ASSIGNMENT_LENGTH + 1)]) {
      const form = new FormData();
      form.set('rules', 'test');
      form.set('assignment', assignment);
      form.append('documents', new File(['document'], 'work.pdf', { type: 'application/pdf' }));
      const before = requests.length;
      const response = await POST(new (require('next/server').NextRequest)('http://localhost/api/analyze', { method: 'POST', body: form }));
      if (assignment.length > constants.MAX_ASSIGNMENT_LENGTH) {
        assert.equal(response.status, 400);
        assert.equal(requests.length, before);
      } else {
        assert.equal(response.status, 200);
        const content = requests.at(-1).input[0].content;
        const assignmentParts = content.filter((part) => part.type === 'input_text' && part.text.startsWith('Задание работы:'));
        assert.deepEqual(assignmentParts, assignment ? [{ type: 'input_text', text: `Задание работы:\n${assignment}` }] : []);
        assert.ok(content.some((part) => part.type === 'input_file'));
      }
    }
  });
});
