# Performance Baseline — measured

> Sprint H left "k6 baseline" outstanding. This file records the first numbers
> that were actually produced by running k6, and what they are and are not
> evidence for.

## Run metadata

| | |
|---|---|
| Date | 2026-07-19 |
| k6 | v0.54.0 (linux/amd64) |
| Environment | **local dev**, WSL2 Ubuntu 24.04, 8 cores |
| API | `localhost:4000`, `USE_MOCK_SERVICES=true` |
| Database | local Postgres (`smart_shaadi`), 217 profiles / 168 approved vendors |
| Network | loopback — **zero** RTT |

## The headline caveat

**These are not staging numbers and must not be used as SLO targets.**

The load generator, the API and the database were on one machine over loopback.
That removes, at minimum: real network RTT, TLS termination, the Railway proxy
hop, connection-pool pressure from other tenants, and cold-start behaviour. A
production P95 will be substantially higher, and the gap is *not* a fixed
offset you can add.

What this run **is** good for:
- proving the endpoints and the k6 suite actually work (they did not — see below)
- a **regression tripwire**: if a local run later shows vendor list P95 at 200ms
  instead of 21ms, something changed in the query, not in the network
- ranking endpoints against each other by cost

## Measured results

All three scenarios passed their thresholds with 0 failed requests.

### `perf/vendors.js` — public vendor listing
20 VUs peak, 90s, 843 requests, **100% success**, 168-row table.

| Metric | avg | p90 | **p95** | max |
|---|---|---|---|---|
| `vendor_list_latency` (page 1) | 11.69 ms | 18.06 ms | **20.78 ms** | 34.34 ms |
| `vendor_filtered_latency` (category + city ILIKE) | 11.39 ms | 16.83 ms | **21.46 ms** | 50.39 ms |
| `vendor_deep_page_latency` (page 6, OFFSET 100) | 11.98 ms | 18.38 ms | **21.12 ms** | 28.85 ms |

Note: deep pagination is **not** measurably slower than page 1. That is a
property of a 168-row table, not evidence that OFFSET pagination scales — at
10k+ vendors this is the first number expected to move, and it is measured
separately precisely so that it can be watched.

### `perf/feed.js` — authenticated match feed
20 VUs peak, 90s, 746 requests, **100% success**, 0 circuit-breaker opens.

| Metric | avg | p90 | **p95** | max |
|---|---|---|---|---|
| `feed_latency` (page 1) | 7.48 ms | 11.60 ms | **16.15 ms** | 29.40 ms |
| `feed_offset_latency` (page 2) | 7.18 ms | 11.38 ms | **15.35 ms** | 31.60 ms |

**Important:** the seeded QA user's feed returns **zero items**. This measures
the auth middleware, the profile resolution and the feed query — but not
payload assembly or scoring over a populated result set. It is a floor, not a
representative figure. Getting a real feed number needs a seeded user whose
reciprocal-matching filters actually surface profiles.

### `perf/analytics.js` — admin dashboard
10 VUs peak, 80s, 334 requests, **100% success**, 0 timeouts.

| Metric | avg | p90 | **p95** | max |
|---|---|---|---|---|
| `analytics_stats_latency` (`/admin/stats`) | 16.09 ms | 26.07 ms | **28.38 ms** | 33.96 ms |
| `analytics_query_latency` (payments revenue rollup) | 21.51 ms | 34.80 ms | **38.34 ms** | 46.23 ms |

The revenue rollup is the most expensive read measured here, which is the
expected shape — it aggregates over `payments`, the table Sprint H added the
`(status, created_at)` index for.

### `perf/auth.js` — NO BASELINE, and this is the correct outcome

Better Auth caps OTP sends at **3 per 10-minute window**
(`rateLimit` in `apps/api/src/auth/config.ts`), and the quota is keyed by
**source IP**, not by phone number — twenty VUs on twenty never-before-used
numbers from one host still produced 20/20 `429`s.

A single load generator therefore cannot measure this flow. Any auth latency
number obtained from one host is the limiter's rejection latency. Real numbers
need distributed load from multiple source IPs, or a dedicated perf environment
with the limiter relaxed — which must never be done anywhere user-facing.

The limiter working under load is itself a useful result: the anti-abuse
control on the most abusable endpoint in the product does what it says.

## The suite had never been run before this

Every one of the three pre-existing scripts was broken in a way that made
execution impossible or meaningless, while `feed.js` and `auth.js` carried
recorded baselines in their headers ("cold P95=280ms", "sendPhone: P95=450ms")
dated 2026-07-18. k6 was not installed on this machine. Those numbers were
never measured.

| Script | Defect | Effect |
|---|---|---|
| `feed.js` | `circuit_breaker_open: ['value==0']` — `value` is not a valid aggregation for a Counter | k6 **refuses to start the run** |
| `feed.js` | `Array.isArray(body.data)` but the envelope's `data` is `{items,total,page,limit}` | check could only ever fail |
| `feed.js` | paginated with `offset=`; endpoint takes `page=` | page 2 silently returned page 1 |
| `analytics.js` | `analytics_timeouts: ['value<10']` | k6 refuses to start |
| `analytics.js` | hit `/api/v1/admin/analytics?metric=retention` — **does not exist**, and the check accepted "200 **or 404**" | half of every run timed Express's 404 handler and reported it as analytics latency |
| `auth.js` | posted to `/api/auth/phone` + `/api/auth/verify-otp` — neither exists; body keyed `phone` not `phoneNumber`; asserted `body.success`, which Better Auth never returns | every request 404'd |

All are fixed. The lesson is the one Sprint G and H already recorded and this
repeats a third time: **an artifact that has never been executed is not a
deliverable, and a recorded number with no run behind it is worse than a blank
space** — a blank invites measurement, a fabricated number invites comparison.

## Reproducing

```bash
# 1. API must be running (pnpm dev), with a seeded local database.
# 2. Public — no auth needed:
k6 run perf/vendors.js

# 3. Authenticated — mint a session cookie first:
API=http://localhost:4000; JAR=/tmp/k6.jar; PHONE="+917000000001"
curl -s -c $JAR -X POST "$API/api/auth/phone-number/send-otp" \
  -H 'Content-Type: application/json' -d "{\"phoneNumber\":\"$PHONE\"}" -o /dev/null
curl -s -b $JAR -c $JAR -X POST "$API/api/auth/phone-number/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"phoneNumber\":\"$PHONE\",\"code\":\"123456\"}" -o /dev/null
COOKIE=$(awk '/better-auth/ {printf "%s=%s; ", $6, $7}' $JAR)

AUTH_TOKEN="$COOKIE" k6 run perf/feed.js
# analytics needs an ADMIN session — seed phone +917000000002
AUTH_TOKEN="$ADMIN_COOKIE" k6 run perf/analytics.js
```

Mind the OTP quota: 3 sends per 10 minutes per source IP. Minting cookies in a
tight loop will lock you out of your own dev box for ten minutes.

## Next

1. Re-run all three against **staging** over a real network. Those numbers, not
   these, are what SLO targets get calibrated from.
2. Seed a QA user with a non-empty match feed so `feed.js` measures payload
   assembly rather than an empty result set.
3. Grow the vendor table to a realistic size and re-check
   `vendor_deep_page_latency` — that is the number that decides whether OFFSET
   pagination survives.
