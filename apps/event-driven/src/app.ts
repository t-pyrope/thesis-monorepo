import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { login, requireAuth } from './auth.js';
import { browserAccess } from './http.js';
import { SESSION_COOKIE } from './session.js';
import { readFormData, InvalidFormData } from './analyze.js';
import { analyzeSchema } from './validation.js';
import { DOCUMENTS } from './documents.js';
import { rateLimit } from './rate-limit.js';
import { sessionOwner, EVENT_NAME, resultKey, type AnalysisRequested, type Manifest } from './jobs.js';
import { putJson, getJson, type ObjectStore } from './storage.js';
import { logAnalysisError, measureAnalysisRequest, measureAnalysisStage } from './instrumentation/analysis.js';

export function createApp(queue: Queue<AnalysisRequested>, store: ObjectStore, limit = rateLimit) {
  const app = new Koa({ proxy: process.env.TRUST_PROXY === 'true', maxIpsCount: 1 });
  const router = new Router();
  app.use(async (ctx, next) => {
    try { await next(); } catch (error) {
      logAnalysisError('analysis.api.error', error);
      ctx.status = 503;
      ctx.body = { error: 'Backend is unavailable' };
    }
  });
  app.use(browserAccess);
  router.get('/health', ctx => { ctx.set('Cache-Control', 'no-store'); ctx.body = { status: 'ok' }; });
  router.post('/login', bodyParser({ enableTypes: ['json', 'form'] }), login);
  router.get('/analyze', requireAuth, ctx => { ctx.body = 'ok'; });
  router.post('/analyze', requireAuth, async ctx => {
    const response = await measureAnalysisRequest(async () => {
      try {
        if (!(await measureAnalysisStage('request.rate_limit', () => limit(`analyze:${ctx.ip ?? 'unknown'}`, 10, 60)))) {
          return { status: 429, body: { error: 'Too many requests' } };
        }
        let form: FormData;
        try { form = await measureAnalysisStage('request.form_data', () => readFormData(ctx)); }
        catch (error) {
          if (error instanceof InvalidFormData) return { status: 400, body: { error: 'Bad request' } };
          throw error;
        }
        const parsed = analyzeSchema.safeParse({ rules: form.get('rules'), assignment: form.get('assignment') ?? '', documents: form.getAll('documents') });
        if (!parsed.success || !parsed.data.documents.length ||
            new Set(parsed.data.documents.map(doc => doc.name)).size !== parsed.data.documents.length) {
          return { status: 400, body: { error: 'Bad request' } };
        }
        const { rules, assignment, documents } = parsed.data;
        if (!DOCUMENTS.some(profile => profile.profile_id === rules)) return { status: 403, body: { error: 'Invalid input' } };
        const jobId = randomUUID();
        const manifest: Manifest = { rules, assignment, documents: [] };
        for (const [index, doc] of documents.entries()) {
          const key = `analyses/${jobId}/documents/${index}`;
          await measureAnalysisStage('storage.document.write', async () => store.put(key, new Uint8Array(await doc.arrayBuffer()), doc.type));
          manifest.documents.push({ key, name: doc.name, type: doc.type });
        }
        const manifestKey = `analyses/${jobId}/manifest.json`;
        await putJson(store, manifestKey, manifest);
        await measureAnalysisStage('queue.publish', () => queue.add(EVENT_NAME, {
          manifestKey, owner: sessionOwner(ctx.cookies.get(SESSION_COOKIE, { signed: false })!),
        }, { jobId, attempts: 1 }));
        return { status: 202, body: { jobId } };
      } catch (error) {
        logAnalysisError('analysis.request.error', error);
        return { status: 503, body: { error: 'Backend is unavailable' } };
      }
    });
    ctx.status = response.status;
    ctx.body = response.body;
  });

  const readJob: Koa.Middleware = async (ctx, next) => {
    const id: string = ctx.params.jobId;
    if (!/^[a-f0-9-]{36}$/.test(id)) { ctx.status = 404; return; }
    const job = await queue.getJob(id);
    const owner = sessionOwner(ctx.cookies.get(SESSION_COOKIE, { signed: false })!);
    if (!job || job.data.owner !== owner) { ctx.status = 404; ctx.body = { error: 'Job not found' }; return; }
    ctx.state.job = job;
    const state = await job.getState();
    ctx.state.status = state === 'completed' ? 'completed' : state === 'failed' ? 'failed' : state === 'active' ? 'running' : 'queued';
    await next();
  };
  router.get('/jobs/:jobId', requireAuth, readJob, ctx => {
    ctx.body = { jobId: ctx.state.job.id, status: ctx.state.status,
      ...(ctx.state.status === 'failed' ? { error: 'Analysis failed' } : {}) };
  });
  router.get('/jobs/:jobId/result', requireAuth, readJob, async ctx => {
    if (ctx.state.status !== 'completed') {
      ctx.status = ctx.state.status === 'failed' ? 409 : 202;
      ctx.body = { jobId: ctx.state.job.id, status: ctx.state.status };
      return;
    }
    ctx.body = await getJson(store, resultKey(ctx.state.job.id));
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
