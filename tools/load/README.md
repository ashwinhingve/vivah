# Load Tests

> Tooling for verifying performance acceptance criteria from the
> stabilization plan §1.4: 100 RPS sustained for 5 min on `/profiles/matches`
> and `/bookings`, p95 < 500ms.

## Setup

1. Install k6: https://k6.io/docs/getting-started/installation
2. Get a staging session cookie:
   ```bash
   # Log into staging, open DevTools → Application → Cookies
   # Copy the better-auth.session_token cookie value
   export STAGING_SESSION_COOKIE='better-auth.session_token=<value>'
   ```

## Run

```bash
# Default — hits staging-api.smartshaadi.co.in
k6 run tools/load/k6.js

# Custom base URL
k6 run -e BASE_URL=https://api.smartshaadi.co.in tools/load/k6.js

# Smoke only (no load — just hits /health and /ready)
k6 run --tag scenario=smoke tools/load/k6.js
```

## Acceptance criteria

| Metric | Target | Plan ref |
|--------|--------|----------|
| `/profiles/matches` p95 | < 500ms @ 100 RPS sustained 3 min | §1.4 #6 |
| `/bookings` p95 | < 500ms @ 50 RPS sustained 3 min | §1.4 #6 |
| Error rate | < 1% | §1.4 #6 |

## What to check after a run

1. **k6 summary line** — `http_req_duration p(95)` for each scenario.
2. **Grafana** during the run — RPS chart, queue depth, DB connection count.
3. **Sentry** — should be empty during the run; any new error needs investigation.
4. **Postgres slow query log** — anything > 200ms during the test indicates an index gap.

## If the budget is missed

1. **Identify the slow endpoint.** k6 output shows per-route p95.
2. **Check Postgres `EXPLAIN ANALYZE`** on the offending query. Likely missing index.
3. **Check Mongo `.explain()`** if profile content is in the path.
4. **Scale Railway** vertically if CPU-bound, horizontally if connection-bound.

## Calibrating for production

Staging has weaker hardware than production typically. A run that hits 80 RPS
@ 500ms p95 on staging usually maps to 200 RPS @ 300ms p95 on production
(rough rule of thumb; verify with a production canary load run before launch).
