> This app is now an npm workspace. Install dependencies and run commands from the monorepo root; see [root README](../../README.md) for current build, run and deployment instructions. The details below describe the original app's behavior.

# Academic analyzer backend

Requires Node.js 22.14+ (PDF.js), npm, and these environment variables:

- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for the shared rate limiter
- `SESSION_SECRET` (at least 32 characters), `APP_PASSWORD_HASH` for login
- `PORT` (optional, default 3000)

Run `npm install`, `npm run build`, then `npm start`. Run tests with `npm test`.

## POST /analyze

Requires the session cookie issued by `/login`. Send `multipart/form-data`:

- `rules`: profile ID from `src/docs/01-czu-pef-bakalarka.json` (same enabled profile as the serverless app)
- `assignment`: optional assignment text, up to 5,000 characters
- `documents`: repeated PDF or DOCX file fields; at least one, with unique filenames

The total multipart body is limited to 50 MiB. Documents are processed sequentially,
first PDF checks, then AI analysis. Response: `{ "filename.pdf": { "pdf": {...}, "ai": {...} } }`.
The PDF pipeline is identical to the serverless implementation, including table
extraction. Its current limitation is also preserved: although input validation accepts
DOCX, the PDF parser cannot analyze it and the request fails. Use PDF for comparisons.

AI prompts, model (`gpt-5.6-terra`), response schema, profile and PDF checks are
ported from `academic-analyzer-fe`. The request logs preserve its JSON events,
request/document correlation IDs, stage timings, OpenAI operation counts and
approximate payload sizes. Documents and assignment text are not logged.

Errors match the serverless endpoint: 400 invalid input, 403 unknown profile,
429 rate limit (10 requests per 60 seconds), 500 analysis/provider failure.
Authentication failures return 401. A batch failure returns 500, without partial results.

Rate limiting uses Koa's `ctx.ip`. If deployed behind a reverse proxy, configure
trusted proxy handling for that deployment before relying on client IP limits.
Tests use service doubles and do not make paid OpenAI requests.

## Experiment parity

`src/docs/01-czu-pef-bakalarka.json` is a complete, independent copy of the
serverless app’s `app/docs/01-czu-pef-bakalarka.json`. No rules JSON is sent
from FE to BE: the multipart `rules` field contains only `profile_id`. The BE
selects its local profile and uses `documentRules` for PDF checks and `rules`
for AI analysis. Keep both copies synchronized manually when changing the experiment.

All modules in `src/pdf` are copied from the serverless app’s `lib/pdf`; only
TypeScript type imports and module paths are adapted for Node ESM.

## Deploy and test on Render

1. Push this repository to your Git provider. In Render choose **New → Blueprint**,
   connect the repository and use `render.yaml`. It defines a free Node web service,
   `npm ci --include=dev && npm run build`, `npm start`, and `/health`.
2. Enter `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
   and `APP_PASSWORD_HASH` (the bcrypt hash, not the password). Render generates
   `SESSION_SECRET`. Do not upload `.env` or put secrets in the Blueprint.
3. Set `ALLOWED_ORIGINS` to the exact FE origin, e.g. `https://your-fe.vercel.app`,
   with or without a trailing slash (normalized automatically). Paths, query strings,
   fragments, credentials and wildcards are rejected. Multiple origins can be comma-separated; local FE
   origins must be explicitly listed too. The Blueprint uses `COOKIE_SAME_SITE=none`
   for cross-site requests. Use `lax` if FE and BE are on the same site.
4. Deploy and open `https://<service>.onrender.com/health`; expect `{"status":"ok"}`.
   Startup rejects missing configuration. Health checks do not call OpenAI/Redis
   and do not verify API credentials, model access, or available provider credits.
5. Log in **on this backend** with `POST /login`, then send PDFs to `POST /analyze`.
   An existing FE-domain cookie is not sent to the Render domain. Browser requests
   to both endpoints must use `credentials: 'include'`:

   ```js
   const api = 'https://<service>.onrender.com';
   await fetch(`${api}/login`, {
     method: 'POST', credentials: 'include',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ password }),
   });
   const form = new FormData();
   form.set('rules', selectedProfileId);
   form.set('assignment', assignment ?? '');
   for (const file of files) form.append('documents', file);
   const response = await fetch(`${api}/analyze`, {
     method: 'POST', credentials: 'include', body: form,
   });
   // Do not manually set Content-Type for FormData; the browser adds the boundary.
   const result = await response.json();
   ```

`TRUST_PROXY=true` lets Koa recognize Render's forwarded HTTPS and client IP;
keep it disabled when the app is directly exposed without a trusted proxy. Render
handles TLS, and the server binds to `0.0.0.0:$PORT`. Cookies remain Secure/HttpOnly.
Some browsers block third-party cookies even with SameSite=None. For browser
experiments use FE/BE subdomains of the same custom domain when this occurs;
otherwise test with a cookie-capable HTTP client. A FE proxy changes the measured
network path, so document it if used. Frontend code is not modified in this repo.

For performance comparisons, record region, instance size, Node/package versions,
and distinguish cold and warm runs. Free Render instances sleep after 15 minutes
of inactivity; their first request can take about a minute to wake up. Use a paid
instance for consistent warm-server measurements. Start with one small PDF and
one request at a time: PDF parsing and uploads buffer data in memory. A 50 MiB
request limit does not bound total parser memory. Long in-flight analyses can be
interrupted by a deploy; do not deploy during a measurement run.

The application log byte counters estimate OpenAI payloads only; they exclude
transport overhead/retries, browser-to-BE traffic, and Redis traffic. Measure those
separately when comparing total network usage. If both apps share one Upstash DB,
their `analyze:<ip>` rate-limit keys can interact. Use separate databases (same region)
or run batches far enough apart to avoid affecting the comparison.

References: [Render web services](https://render.com/docs/web-services),
[health checks](https://render.com/docs/health-checks),
[free instance limits](https://render.com/docs/free).
