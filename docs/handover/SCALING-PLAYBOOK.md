# Scaling Playbook

> Phase 8 Sprint H (Unit 8.3). How Smart Shaadi is expected to behave under load,
> what to watch, and what to change first when it doesn't.

## Read this first

Smart Shaadi has **not yet carried production traffic**. Everything below is a
capacity *model* derived from the code's configured limits, not a measurement. The
numbers are starting points and explicit assumptions to falsify — not proven ceilings.
The first real traffic should be treated as the experiment that replaces this document's
estimates with facts.

Where a claim is an assumption, it is labelled as one.

## Current shape

A **modular monolith**: one Node/Express API process serving all domains, with Bull
workers running in-process, plus a separate Python AI service. See
`docs/ARCHITECTURE.md` for why this shape was chosen and the intended split path.

Consequence that matters most for scaling: **the workers share the API's event loop and
memory.** A CPU-heavy job (PDF rendering, embedding generation) steals time from request
handling in the same process. That is the single most important property to remember when
diagnosing latency.

## Configured limits

These are what the code actually sets — verify against the source before relying on them.

| Resource | Limit | Where |
|---|---|---|
| Postgres pool | `max: 20`, idle 30s, connect timeout 5s | `apps/api/src/lib/db.ts` |
| MongoDB pool | `maxPoolSize: 20`, server-selection 10s, socket 45s | `apps/api/src/lib/mongo.ts` |
| Redis | single connection, `maxRetriesPerRequest: 3`, `family: 0` (Railway IPv6) | `apps/api/src/lib/redis.ts` |
| Bull queues | separate ioredis connection (cannot share the singleton) | `apps/api/src/infrastructure/redis/queues.ts` |
| Job retries | 5 attempts, exponential backoff from 5s | same |
| Request body | `50kb` | `apps/api/src/index.ts` |
| Rate limit (global) | 600 req / 5 min / IP | `apps/api/src/lib/rateLimit.ts` |
| Rate limit (auth) | 30 req / 15 min / IP | same |
| Rate limit (match actions) | 20 req / 60s / IP | same |
| Graceful shutdown | 30s hard cap | `apps/api/src/index.ts` |

### Worker concurrency

Set explicitly in Sprint H so a slow bulk queue cannot starve a latency-sensitive one.
Before this, queues relied on the implicit default and competed freely.

| Queue | Concurrency | Reasoning |
|---|---|---|
| `match-compute` | 3 | Compute-heavy; low ceiling keeps it from monopolising the loop |
| `notifications` | 10 | User-visible latency; needs headroom |
| `escrow-release` | 5 | Touches money and calls Razorpay — deliberately bounded |
| `order-expiry` | 10 | DB-only, no external calls |
| `invitation-blast` | 15 | Only schedules; the actual sends go through `notifications` |

**These are judgement calls, not measurements.** The ordering (bulk < critical) is the
defensible part; the absolute values need revisiting once the histogram has real data.

## The first bottleneck

**Assumption: the Postgres pool (20) is the binding constraint, not CPU.**

The reasoning: most endpoints are IO-bound reads, and 20 connections shared across all
request handlers *and* in-process workers is a small budget. The workers borrow from the
same pool, so a burst of jobs directly reduces the connections available to serve
requests.

Falsify it by checking, under load, whether `pg_stat_activity` saturates before CPU does:

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

If connections saturate while CPU sits low, raise the pool. If CPU saturates first, the
assumption is wrong and the answer is horizontal scaling instead.

## What to change, in order

1. **Raise the Postgres pool** (20 → 40) if connections saturate before CPU. Cheapest
   possible change. Check Railway's own connection ceiling first.
2. **Move workers out of the API process.** The highest-leverage structural change: run a
   separate worker dyno consuming the same queues. Removes the CPU contention described
   above and lets the two scale on different axes. Do this before adding API replicas.
3. **Add API replicas.** The app is already replica-safe — sessions live in Redis, and
   Socket.io uses the Redis adapter for cross-instance broadcast. Watch that pool ×
   replicas stays under Postgres `max_connections`; add PgBouncer when it doesn't.
4. **Cache the analytics/report reads.** The Unit 8.3 reports recompute aggregates on
   every request. They are the most expensive read path and the most cacheable — the data
   changes at most daily. A short Redis TTL removes them from the hot path entirely.
5. **Read replica** for analytics and reporting, once those queries measurably affect
   transactional latency.

## Known hazards

- **PDF rendering is synchronous.** Report generation blocks the event loop for the
  duration of the render. Under concurrent report load this shows up as latency on
  *unrelated* endpoints. `REPORTS_ENABLED=false` sheds it immediately without a deploy
  (see `ENV-MATRIX.md`); the durable fix is to move rendering to a queue and deliver the
  PDF via R2 rather than streaming it inline.
- **Redis is a single point of failure.** Sessions, match cache, queues and the Socket.io
  adapter all depend on it. Redis down = effectively a full outage, not degraded service.
- **No bulkhead between queues.** Concurrency limits bound each queue, but all workers
  still share one process. Item 2 above is the real fix.
- **Circuit breakers are per-process.** With multiple replicas each keeps its own state,
  so an outage opens N breakers independently. Acceptable, but it means breaker metrics
  must be read per-instance, not as a single global signal.
- **`/metrics` is unauthenticated when `METRICS_TOKEN` is empty.** Set it in production.

## Watch these

Exposed on `GET /metrics` (Prometheus text format, bearer-gated by `METRICS_TOKEN`):

| Signal | Why |
|---|---|
| `http_request_duration_seconds` | P50/P95/P99 — the primary latency SLI (added in Sprint H) |
| `http_requests_total` | Throughput and error rate by route/method/status |
| `bull_queue_depth` | Rising depth = workers falling behind; the earliest saturation warning |
| `circuit_breaker_state` | 0 closed / 1 half-open / 2 open — a non-zero value means a provider is failing |
| `process_memory_rss_bytes` | Leak detection |
| `process_uptime_seconds` | Unexpected restarts / crash loops |

Alert thresholds and burn rates: `SLO-AND-ALERTING.md`.

## Load testing

k6 scripts live in `perf/` (`auth.js`, `feed.js`, `analytics.js`) with thresholds and run
instructions in `perf/README.md`. **No baseline has been recorded yet** — capturing one
against staging is the natural first task for whoever picks this up, and `perf/README.md`
has the place to write it down.

## Related

- `docs/ARCHITECTURE.md` — system design and the monolith→services split path
- `docs/RUNBOOK.md` — incident playbooks (webhook flood, escrow stuck, Mongo down, Redis)
- `docs/handover/INDEX-PLAN.md` — query/index rationale
- `docs/handover/SLO-AND-ALERTING.md` — SLI/SLO definitions
- `docs/handover/ENV-MATRIX.md` — every flag, including the kill-switch
