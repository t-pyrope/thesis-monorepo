# backend-common

Private server-side workspace shared by the Koa backends and Next.js serverless API. It contains HTTP/CORS middleware, multipart form parsing and IP rate limiting, with no dependency on analysis-core, PDF.js or OpenAI.

```ts
import { browserAccess, allowedOrigins, isAllowedOrigin } from "@academic-analyzer/backend-common/http";
import { readFormData, InvalidFormData } from "@academic-analyzer/backend-common/form-data";
import { rateLimit, createRateLimit } from "@academic-analyzer/backend-common/rate-limit";
```


Shared IP rate limiting is exported as `@academic-analyzer/backend-common/rate-limit`. `rateLimit` keeps lazy Redis initialization for backend processes; `createRateLimit(redis)` allows the serverless adapter to preserve eager initialization. Defaults (5 requests / 60 seconds), sliding window, key prefix and Upstash REST environment variables are unchanged. Limiter instances remain local to each application process.

Shared Koa browser access middleware and origin validation are exported from `@academic-analyzer/backend-common/http`: `browserAccess`, `allowedOrigins`, `isAllowedOrigin`. Traditional and event-driven use this single implementation. `ALLOWED_ORIGINS`, credentialed CORS/preflight responses and actual-request origin checks remain unchanged. Koa is imported only as a type; the shared module adds no Koa runtime dependency.

Run `npm run build:backend-common` from the monorepo root after changes, or `npm run dev --workspace @academic-analyzer/backend-common` to watch TypeScript. `npm run build:shared` builds both shared packages. Application dev/build hooks build their shared dependencies first. Routes and queues remain in the applications; shared Koa authentication and session handling live in this package.

Shared multipart parsing is exported from `@academic-analyzer/backend-common/form-data`. `readFormData(ctx)` requires `multipart/form-data`, buffers up to 50 MiB of the request body and parses it with the native Request API. Invalid content types, oversized bodies and multipart parsing errors throw `InvalidFormData`, which the Koa routes map to HTTP 400. Traditional and event-driven use the same implementation.

Shared Koa authentication is exported from `@academic-analyzer/backend-common/auth` (`login`, `requireAuth`). Session helpers and cookie settings are exported from `@academic-analyzer/backend-common/session`. Both Koa backends use these implementations. Login checks allowed origins and `APP_PASSWORD_HASH` with bcrypt, then issues an eight-hour HMAC-signed session using `SESSION_SECRET`. Cookie security, `COOKIE_SAME_SITE`, token format, response statuses and cache headers are preserved. The frontend keeps its existing session adapter.

Authentication and session tests live in `tests/auth.test.ts`. Run `npm run test --workspace @academic-analyzer/backend-common` from the monorepo root. The root `npm test` also includes these tests through the workspace test runner.
