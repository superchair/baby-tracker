# Security & Performance Review

Findings from a critical review of the application and infrastructure code
(2026-09-10). Covers `infra/` (AWS CDK + Lambda) and `frontend/` (React
SPA). `npm audit` was run on both projects — zero known vulnerabilities in
all dependencies, production and dev.

This started as a discussion list; items are marked ✅ Fixed as they're
addressed. Severity reflects actual exploitability/impact given this app's
context (small trusted household, most findings sit behind an
already-authenticated trust boundary).

## Security

| Severity | Finding |
|---|---|
| **Medium** | ✅ **Fixed** (2026-09-10) — **SSRF via unvalidated push endpoint** — `infra/lambda/pushSubscribe/index.ts` accepted any string as `endpoint`; `infra/lambda/reminderCheck/index.ts` later fetches it as a URL on a schedule. Fixed by adding an allowlist of known Web Push service hosts (`isAllowedPushEndpoint` in `infra/lambda/shared/types.ts`), enforced both at subscribe-time (Zod `.refine`) and again defensively in `reminderCheck` before sending (which also deletes any pre-existing non-conforming record). |
| **Low** | **IAM over-permissioning** — `infra/lib/lambdas.ts`: every Lambda gets `table.grantReadWriteData()` regardless of what it does (e.g. `eventsList`/`configGet` only need read access). Not exploitable on its own; amplifies blast radius if any function is ever compromised via another vulnerability. |
| **Low** | **CDK stack has no pinned `env` (account/region)** — `infra/bin/infra.ts` is environment-agnostic. Nothing stops a future deploy under the wrong AWS profile from silently landing in the wrong account. Operational safeguard more than an attacker-facing issue, but this exact mistake almost happened earlier in this project. |
| **Low** | **`createdBy` is client-asserted, not cryptographically verified** — `infra/lambda/shared/auth0.ts` / `frontend/src/api/client.ts`. A deliberate, previously discussed trade-off. Only affects attribution among already-trusted household members, not access control. |
| **Low** | **No CloudFront response security headers** (HSTS, X-Content-Type-Options, frame-ancestors) — `infra/lib/site.ts`. Standard hardening; only matters if chained with another future vulnerability (no known XSS exists today). |
| **Low** | ✅ **Fixed** (2026-09-11) — **No API Gateway throttling configured** — `infra/lib/api.ts` relied on the high account-level default. Fixed by setting `DefaultRouteSettings` (10 req/s steady, burst 20) on the HTTP API's default stage via the L1 escape hatch (no L2 prop exists for this on `HttpApi`) — generous for a household of a couple of people, but bounds the cost/DoS blast radius of a leaked or abused token. |
| **Low** | **Access tokens persisted to `localStorage`** — `frontend/src/App.tsx` (`cacheLocation="localstorage"`). Another deliberate earlier trade-off (persistent PWA login). Only exploitable if an XSS vector is ever introduced; none found. |
| **Informational** | **Auth0 Login Action (email allowlist) isn't version-controlled** — lives only in the Auth0 dashboard, no change history or backup. |
| **Informational** | **Authorizer cache creates a 5-minute revocation-lag window** after removing someone from the allowlist (`infra/lib/api.ts`, `resultsCacheTtl`). |

## Performance

| Severity | Finding |
|---|---|
| **High** | ✅ **Fixed** (2026-09-11) — **Dashboard fetches the entire 30-day event list just to read the first item** — `frontend/src/pages/Dashboard.tsx` called `getEvents({type:'FEEDING'})` / `getEvents({type:'DIAPER'})` with no range, downloading 150–300+ full events (at current logging pace) on every dashboard load and after every single log action, when only the single most-recent record was needed. Fixed by adding an optional `limit` query param to `GET /events` (`infra/lambda/eventsList/index.ts`) that caps and short-circuits the DynamoDB pagination loop server-side, and having the dashboard request `limit: '1'`. History/Stats are unaffected (they still fetch full ranges by omitting `limit`). |
| **Medium** | ✅ **Fixed** (2026-09-11) — **`eventsList` had no cap and looped through unbounded pagination** — `infra/lambda/eventsList/index.ts`. Fixed with two absolute ceilings: date range width is clamped to 90 days (keeping the most recent portion of an overly wide request rather than erroring) and item count is capped at 1000 (also the new default when no explicit `limit` is given), with the DynamoDB pagination loop stopping as soon as the cap is reached. `from`/`to` are now also validated as parseable dates, returning 400 on malformed input instead of silently misbehaving. |
| **Medium** | ✅ **Fixed** (2026-09-11) — **No code-splitting — single ~874KB/256KB-gzipped JS bundle** — `frontend/vite.config.ts`. Recharts loaded up front even though only Stats/Dashboard-activity charts use it. Fixed with route-based lazy loading (`React.lazy`/`Suspense` in `App.tsx` for every page) plus lazy-loading `DailyActivityChart` specifically within Dashboard, since it lives on the home screen. Recharts now splits into its own ~352KB chunk, loaded only when Stats or the dashboard chart actually needs it, after the log buttons are already interactive. Initial bundle for the Login screen dropped from ~874KB/256KB gzipped to ~447KB/136KB gzipped. |
| **Medium** | **No cache-control differentiation between `index.html` and hashed assets** — `infra/lib/site.ts`. Can cause an actual broken-app-until-hard-refresh failure (stale `index.html` referencing since-replaced asset hashes), not just suboptimal caching. |
| **Low** | ✅ **Fixed** (2026-09-11) — **Lambda memory fixed at 256MB everywhere** — `infra/lib/lambdas.ts`. Bumped `authorizer` (RS256 JWT verification) and `reminderCheck` (VAPID/web-push signing + encryption) to 512MB, since those do meaningful CPU-bound crypto work where more memory translates directly into lower latency/cost. Left the plain CRUD handlers (`eventsCreate`, `eventsList`, etc.) at 256MB -- they're I/O-bound waiting on DynamoDB round-trips, so more CPU wouldn't meaningfully help and would just add cost. |
| **Low** | **No CloudWatch Logs retention set** — `infra/lib/lambdas.ts`. Log storage/cost grows unbounded indefinitely. |

## Minor / housekeeping

| Severity | Finding |
|---|---|
| **Medium** | **No DynamoDB backup** (no point-in-time recovery, `RemovalPolicy.DESTROY`) — `infra/lib/table.ts`. This now holds real, irreplaceable family data with no restore path if a bad deploy or bug destroys it. |
| **Low** | Production API's CORS allow-list permanently includes `http://localhost:5173` (`infra/lib/infra-stack.ts`) — low actual risk, just unnecessary exposure. |
| **Informational** | PWA manifest description still mentions "sleep" events, which were removed (`frontend/vite.config.ts`). |
| **Informational** | `sourceMap: true` on all Lambda bundles (`infra/lib/lambdas.ts`) with nothing configured to consume the source maps — dead weight in the deployed package. |
| **Informational** | No `cdk-nag` or similar automated infra security linting in the project. |

## Suggested starting point

The two **High/Medium** performance items with real, current impact
(dashboard over-fetching, DynamoDB backups), then the SSRF fix as the top
security item.
