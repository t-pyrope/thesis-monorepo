# Thesis monorepo

Private npm workspaces; no npmjs publishing, Git package releases or Turborepo required.

```text
apps/frontend         Next.js UI, serverless analysis and remote backend proxies
apps/traditional      Synchronous Koa API
apps/event-driven     Koa API, BullMQ and separate worker
packages/analysis-core Shared PDF checks, table extraction, AI prompts/model/schema,
                       types, profiles, validation and analysis instrumentation
packages/backend-common HTTP/CORS middleware and IP rate limiting
```

Original directories remain untouched. This is a source snapshot, including local changes, not a merge of their Git histories. Nested Git repositories, dependencies and build outputs are excluded. Existing local `.env` files are copied into their respective apps and ignored by Git. Only `.env.example` is intended for version control.

## Install and run

Node 22.14+; recommended version is in `.nvmrc`. Install once from this directory:

```sh
npm ci
npm run build:shared
npm run dev:frontend
```

In separate terminals as needed:

```sh
PORT=3001 npm run dev:traditional
PORT=3002 npm run dev:event-driven
npm run dev:worker
```

For local remote modes, set frontend `TRADITIONAL_BACKEND_URL=http://localhost:3001` and `EVENT_DRIVEN_BACKEND_URL=http://localhost:3002`. The commands above assign separate API ports; the frontend normally uses 3000. Use HTTPS for the browser when using Secure session cookies.

Frontend keeps `BACKEND_MODE`, `TRADITIONAL_BACKEND_URL` and `EVENT_DRIVEN_BACKEND_URL`. Each app keeps its own environment and authentication configuration; see its `.env.example`. Existing PDF checks, LLM prompt/model/parameters, result format and event-driven polling behavior are preserved. Backend AI clients remain lazy; the serverless client retains its existing lifecycle. No result caching, batching or streaming is introduced.

`npm run build` builds all applications. Individual builds: `build:frontend`, `build:traditional`, `build:event-driven`; each builds both shared packages first. Production commands: `start:frontend`, `start:traditional`, `start:event-driven`, `start:worker`.

After editing backend-common, run `npm run build:backend-common`, or its `dev` script to watch TypeScript. `npm run build:shared` builds both shared packages.

After editing analysis-core, run `npm run build:core`, or run `npm run dev --workspace @academic-analyzer/analysis-core` in another terminal to watch shared TypeScript. App imports use compiled package exports; no publishing or version update is required. Profile JSON changes require `build:core` to copy assets.

Frontend development and production builds explicitly use Webpack (`next dev --webpack`, `next build --webpack`).

## Vercel

Connect this repository to the frontend project. Set Root Directory to **apps/frontend** and enable **Include source files outside of the Root Directory in the Build Step**. The app's `vercel.json` installs from the repository root and runs `build:frontend` so analysis-core is built before Next.js. Keep the existing frontend environment variables in Vercel; local env files are not deployed by Git. Next config traces the repository root and dynamic PDF worker/native assets; shared code is bundled by Webpack.

## Render

Use the root **render.yaml** Blueprint. Leave service Root Directory empty: builds need the root lockfile and packages/analysis-core. Traditional: `npm ci --include=dev && npm run build:traditional`, then `npm run start:traditional`. Event-driven API and worker: `npm ci --include=dev && npm run build:event-driven`, then `npm run start:event-driven` or `npm run start:worker`. Services stay independently deployed.

The event-driven Blueprint expects an existing environment group **academic-analyzer-event-driven** with API/worker credentials as described in apps/event-driven/.env.example. It supplies a shared Redis connection separately. Documents and results remain in a private S3/R2 bucket, not the local filesystem. Concurrency remains 1 and attempts remain 1. See apps/event-driven/README.md for endpoint/storage details.

Changing shared code requires rebuilding/redeploying each consuming service. Environment variables, domains and live Git integrations are configured separately in Vercel/Render; creating this folder does not change them.

## Verify

```sh
npm test
npm run typecheck
npm run lint
# After build:frontend, verify a real PDF using only traced deployment files:
npm run verify:frontend
# Against an isolated Redis instance, to include real BullMQ integration:
TEST_REDIS_URL=redis://127.0.0.1:16379 npm test
```

HTTP route tests open temporary localhost ports; AI tests use stubbed OpenAI transport. The shared PDF integration test exercises a real PDF, font assets and isolated table extraction from a temporary working directory.

References: [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/), [Vercel monorepos](https://vercel.com/docs/monorepos), [Vercel root directory access](https://vercel.com/docs/monorepos/monorepo-faq), [Render monorepos](https://render.com/docs/monorepo-support).

Migration note: shared font checking now handles absent font metadata as indeterminate instead of throwing. All determinate font checks and LLM settings are unchanged. Runtime PDF paths are resolved by Node, avoiding bundler module-ID substitution.
