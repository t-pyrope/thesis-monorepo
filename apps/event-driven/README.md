> This app is now an npm workspace. Install dependencies and run commands from the monorepo root; see [root README](../../README.md) for current build, run and deployment instructions. The details below describe the original app's behavior.

# Academic analyzer: event-driven

Koa API → private object storage → `AnalysisRequested` in BullMQ → separate worker → stored JSON result. The analysis modules (`ai.ts`, `pdf/`, rules and types) are copied unchanged from `academic-analyzer-be-traditional`: PDF checks, summary, defence questions, prompts, `gpt-5.6-terra`, medium reasoning and structured output remain identical. Documents in one request are processed sequentially and the result remains `{ "filename.pdf": { pdf, ai } }`.

## Storage and authentication

Use a **private Cloudflare R2 bucket** (S3-compatible), or AWS S3. API and worker access the same bucket over HTTPS from independent Render services. Render disks are not shared between services and are not used. Redis holds job metadata, ownership, timestamps and states; it never holds files, assignment text or analysis results. The queue payload contains only a manifest object key and an HMAC of the authenticated session. Documents, assignment/profile manifest and result JSON are stored under `analyses/<jobId>/` in the bucket.

Keep public bucket access disabled. For R2 create an object read/write API token scoped to this bucket. Set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. For AWS S3 omit `S3_ENDPOINT`, use the bucket region and credentials scoped to GetObject/PutObject on this bucket. No bucket URL or credentials are sent to the browser. This implementation retains objects and BullMQ job records; arrange coordinated object/job deletion if retention is required. Unpublished objects from a failed upload or queue publication can be removed separately; no job is acknowledged until publication succeeds.

Existing bcrypt password login and signed eight-hour `__Host-app-session` cookies are preserved. `SESSION_SECRET` must contain at least 32 characters; `APP_PASSWORD_HASH` is the existing bcrypt hash. Each job belongs to the session which submitted it: another valid session receives 404 for both status and result. Login creates a new session, so jobs from an older session are inaccessible after re-login/expiry. The frontend keeps its existing remote login proxy and mode-specific cookie. Shared frontend/backend session secrets are not required in remote mode.

## Run

Node 22.14+ is required. Copy `.env.example` to `.env` and fill the values without committing secrets. `REDIS_URL` is a TCP `redis://` or TLS `rediss://` connection, distinct from the existing Upstash **REST** variables used by the IP request rate limiter. Redis must use `maxmemory-policy noeviction`.

```sh
npm ci
npm run build
npm start
```

In a separate terminal/process:

```sh
npm run start:worker
```

Development commands are `npm run dev` and `npm run dev:worker`. API requires Upstash REST credentials; worker requires `OPENAI_API_KEY`. Both require Redis and object-storage configuration. `.env.example` lists all variables. Port defaults to 3000.

The frontend configuration keeps its existing names:

```dotenv
BACKEND_MODE=event-driven
EVENT_DRIVEN_BACKEND_URL=https://<api-service>.onrender.com
```

`TRADITIONAL_BACKEND_URL` and serverless behavior are unchanged. Frontend `/api/analyze` still proxies the upload. Only a 202 response invokes event-driven polling through `/api/analyze/jobs/<jobId>` and `/result`. Polling runs on a fixed two-second cadence, skipping ticks while a request is in flight. It stops on completion, failure, HTTP/network errors or component unmount. Aborting client requests does not cancel the job. Results enter the existing local-storage/results-component path. Authentication failure redirects to login. To use Secure `__Host-` cookies locally, serve the frontend through HTTPS; frontend-to-API communication can use localhost HTTP because the proxy forwards the cookie explicitly.

## API contract

All analysis/job routes require a valid session and send `Cache-Control: private, no-store`.

| Route | Response |
| --- | --- |
| `POST /login` | Existing password login, 204 and Secure session cookie |
| `POST /analyze` | Existing multipart fields `rules`, `assignment`, repeated `documents`; 202 `{jobId}` after durable upload and queue publication |
| `GET /jobs/:jobId` | 200 `{jobId,status}`; `queued`, `running`, `completed`, `failed` |
| `GET /jobs/:jobId/result` | 200 original result; 202 if queued/running, 409 if failed |
| `GET /health` | Process health, 200 `{status:"ok"}` |

Invalid request: 400; unknown profile: 403; rate limit: 429; missing/invalid session: 401; missing/non-owned job: 404; unavailable queue/storage: 503. Failure details are logged server-side; the public error is generic. Request body limit remains 50 MiB; duplicate filenames are rejected as in traditional.

## Render deployment

1. Create the private bucket and scoped object-storage credentials.
2. Create an environment group named `academic-analyzer-event-driven` with the populated variables in `.env.example` (omit `PORT` and `REDIS_URL`, supplied by Render). `TRUST_PROXY=true` is configured for the API. Leave `COOKIE_SAME_SITE=lax` when using the frontend proxy. Direct cross-site browser access requires `COOKIE_SAME_SITE=none` and explicit `ALLOWED_ORIGINS`.
3. Deploy `render.yaml` as a Blueprint from this backend directory. It creates a paid, persistent Render Key Value instance with no eviction, a Web Service API and one Background Worker in the same region. If this directory is part of a monorepo, set the service root directory accordingly. Both services use `npm ci --include=dev && npm run build:event-driven`; their start commands differ.
4. Set frontend `BACKEND_MODE=event-driven` and `EVENT_DRIVEN_BACKEND_URL` to the API origin, then redeploy the frontend.

Worker concurrency and global queue concurrency are **1**, attempts are **1**, `maxStalledCount=0`. Processor failures are final; jobs whose worker crashes become failed after BullMQ detects a stalled lock (requires an available worker). There are no automatic analysis retries, caching, batching or streaming. Keep one worker instance; global concurrency also covers overlapping deploys. Graceful worker shutdown waits for its current job. Render's shutdown deadline can still terminate long jobs, which then fail rather than restart.

## Instrumentation and checks

Existing stage, per-document and OpenAI SDK metrics are preserved. Worker `requestId` equals `jobId`, linking those records with `analysis.job.start/end`. Job metrics separately report `queueWaitMs` and `processingMs`; metric emission never changes processing behavior. Queue waiting starts at BullMQ publication, excluding upload/storage time.

```sh
npm test
# Optional real Redis integration, using a dedicated test instance:
TEST_REDIS_URL=redis://127.0.0.1:16379 npm test
```

Tests cover authenticated upload, original result format, queued/running/completed/failed, session ownership, malformed input, publication errors and processor errors. The Redis integration additionally checks real BullMQ completion/failure, one attempt and serial processing. PDF/LLM dependencies and storage are injected in lifecycle tests, avoiding paid API calls. A real provider end-to-end check needs valid bucket and OpenAI credentials.

References: [Render Background Workers](https://render.com/docs/background-workers), [Render Key Value](https://render.com/docs/key-value), [Render Blueprint specification](https://render.com/docs/blueprint-spec), [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/), [BullMQ stalled jobs](https://docs.bullmq.io/guide/jobs/stalled).
