import 'dotenv/config';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { login, requireAuth } from './auth.js';
import { analyze } from './analyze.js';
import { browserAccess } from './http.js';
import { validateEnvironment } from './config.js';

validateEnvironment();

const app = new Koa({
  proxy: process.env.TRUST_PROXY === 'true',
  maxIpsCount: 1,
});
const router = new Router();
const port = Number(process.env.PORT ?? 3000);

router.get('/health', (ctx) => {
  ctx.set('Cache-Control', 'no-store');
  ctx.body = { status: 'ok' };
});

router.post('/login', bodyParser({ enableTypes: ['json', 'form'] }), login);

router.get('/analyze', requireAuth, (ctx) => {
  ctx.body = 'ok';
});
router.post('/analyze', requireAuth, analyze);

app.use(browserAccess);
app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server is listening on port ${port}`);
});

// Stop accepting requests and allow active requests to finish during redeploys.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 25_000).unref();
  });
}
