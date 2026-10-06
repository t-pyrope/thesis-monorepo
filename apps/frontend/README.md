> This app is now an npm workspace. Install dependencies and run commands from the monorepo root; see [root README](../../README.md) for current build, run and deployment instructions. The details below describe the original app's behavior.

# Academic analyzer frontend

Run `npm ci` and `npm run dev`, then open http://localhost:3000.

## Backend selection

Set server-side variables in `.env` or the frontend hosting dashboard. Restart the
frontend after changing them. See `.env.example` for a template without secrets.

| BACKEND_MODE           | Backend                | Configuration                                                                                                        |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `serverless` (default) | Local Next.js analysis | OPENAI_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, APP_PASSWORD_HASH, SESSION_SECRET (32+ characters) |
| `traditional`          | External Koa backend   | TRADITIONAL_BACKEND_URL                                                                                              |
| `event-driven`         | Future backend         | EVENT_DRIVEN_BACKEND_URL                                                                                             |

```dotenv
BACKEND_MODE=traditional
TRADITIONAL_BACKEND_URL=https://academic-analyzer-be-traditional.onrender.com
```

URLs must be HTTP(S) origins without paths, credentials, queries or fragments.
Invalid modes and missing URLs fail explicitly. No NEXT_PUBLIC_ variables are needed.
The local PDF/AI implementation is loaded only in serverless mode.

## External API contract

Browser requests use `/api/login`, `/api/analyze`, `/api/logout`. Next.js proxies
login and analysis to the selected backend. `POST /login` receives JSON
`{ "password": "..." }` and must return success with a `__Host-app-session` cookie
(traditional returns 204), or 401 for a wrong password. FE stores the token in a
separate Secure, HttpOnly cookie per mode and forwards it to `POST /analyze`.

Analysis receives multipart `rules` (profile ID), `assignment` and repeated
`documents`. Successful JSON is `{ "filename.pdf": { "pdf": {...}, "ai": {...} } }`.
Backend statuses/bodies are preserved; connection failures return 502. A 401 sends
the user to login; failed analyses are not saved as results.

The backend validates its own session signature. The external page guard checks
cookie presence only. Logout clears the FE cookie; traditional has no revocation
endpoint, so the issued token expires according to its backend lifetime.

Event-driven currently reserves the same API contract. Its processing is not
implemented. If it introduces job IDs, polling or events, update the adapter/UI
for that protocol before enabling it.

## Render and measurements

Use the actual Render service URL. Backend secrets stay on Render and do not
need to be copied to FE. Check `/health` without running paid analysis.
Server-to-server requests do not require browser CORS or third-party cookies.

The proxy adds a browser → FE → BE hop and buffers uploads in FE. Account for
frontend hosting upload, memory and request-duration limits when comparing
architectures. Backend rate limiting sees the FE outbound IP; browser IP headers
are not forwarded. Render cold starts can also delay requests.


### Event-driven analysis

Keep `BACKEND_MODE=event-driven` and `EVENT_DRIVEN_BACKEND_URL` set to the Koa API origin. Existing remote password login and mode-specific cookies are reused. A 202 upload response returns a job ID; the client polls the authenticated status proxy every two seconds and then fetches the original result. Queued/running states are shown in the form. Polling stops on completion, failure, HTTP/network error or unmount, skips ticks during in-flight requests and never cancels backend work. Serverless and traditional paths remain synchronous.

Run polling tests with `node --test tests/event-driven.test.cjs`. Backend storage, Redis and Render deployment instructions are in the event-driven backend README.
