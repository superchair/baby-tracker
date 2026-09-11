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
| **Low** | **No API Gateway throttling configured** — `infra/lib/api.ts`. Relies on the high account-level default. A valid token could drive unbounded cost with no app-level rate limit; low real risk at this app's scale. |
| **Low** | **Access tokens persisted to `localStorage`** — `frontend/src/App.tsx` (`cacheLocation="localstorage"`). Another deliberate earlier trade-off (persistent PWA login). Only exploitable if an XSS vector is ever introduced; none found. |
| **Informational** | **Auth0 Login Action (email allowlist) isn't version-controlled** — lives only in the Auth0 dashboard, no change history or backup. |
| **Informational** | **Authorizer cache creates a 5-minute revocation-lag window** after removing someone from the allowlist (`infra/lib/api.ts`, `resultsCacheTtl`). |

## Performance

| Severity | Finding |
|---|---|
| **High** | ✅ **Fixed** (2026-09-11) — **Dashboard fetches the entire 30-day event list just to read the first item** — `frontend/src/pages/Dashboard.tsx` called `getEvents({type:'FEEDING'})` / `getEvents({type:'DIAPER'})` with no range, downloading 150–300+ full events (at current logging pace) on every dashboard load and after every single log action, when only the single most-recent record was needed. Fixed by adding an optional `limit` query param to `GET /events` (`infra/lambda/eventsList/index.ts`) that caps and short-circuits the DynamoDB pagination loop server-side, and having the dashboard request `limit: '1'`. History/Stats are unaffected (they still fetch full ranges by omitting `limit`). |
| **Medium** | **`eventsList` has no cap and loops through unbounded pagination** — `infra/lambda/eventsList/index.ts`. Fine today, but grows linearly slower as history accumulates over months/years, and a caller can request an arbitrarily wide range. |
| **Medium** | **No code-splitting — single ~874KB/256KB-gzipped JS bundle** — `frontend/vite.config.ts`. Recharts loads up front even though only Stats/Dashboard-activity charts use it, adding weight before the most latency-sensitive screen (one-handed phone use) can render. |
| **Medium** | **No cache-control differentiation between `index.html` and hashed assets** — `infra/lib/site.ts`. Can cause an actual broken-app-until-hard-refresh failure (stale `index.html` referencing since-replaced asset hashes), not just suboptimal caching. |
| **Low** | **Lambda memory fixed at 256MB everywhere** — `infra/lib/lambdas.ts`. CPU scales with memory; bumping the authorizer in particular (RS256 JWT verification) could lower both cost and latency. |
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
