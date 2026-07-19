# SLOs and Alerting

> Phase 8 Sprint H (Unit 8.3). Service level objectives, the metrics behind them, and
> what should page a human.

## Status: proposed, not yet calibrated

These targets are **proposed**, chosen from what the endpoints ought to achieve given
their work — not from measured production behaviour, because there isn't any yet. Treat
the first month of real traffic as the calibration period.

> **Updated 2026-07-19.** A first k6 baseline now exists, but it is **local
> loopback only** — see `perf/BASELINE.md`. It is enough to rule out gross
> application-level slowness and to act as a regression tripwire. It is not
> enough to calibrate a single target below, and the status stays "proposed".

An SLO that fires constantly gets muted, and a muted SLO is worse than none. If a target
below burns error budget continuously once traffic is real, the correct response is to fix
the target or the service — not to silence the alert.

## The metrics behind them

All from `GET /metrics` (Prometheus text exposition, bearer-gated by `METRICS_TOKEN` —
set it in production, an empty token leaves the endpoint public).

| Metric | Type | Added |
|---|---|---|
| `http_request_duration_seconds` | histogram (`_bucket`/`_sum`/`_count`, labelled route+method+status) | Sprint H |
| `http_requests_total` | counter | earlier |
| `circuit_breaker_state` | gauge, per `service` label — 0 closed / 1 half-open / 2 open | Sprint H |
| `bull_queue_depth` | gauge, per `queue`+`state` | earlier |
| `process_memory_rss_bytes`, `process_uptime_seconds` | gauges | earlier |

Latency is labelled by **route template**, never the raw URL, so per-id paths don't
explode cardinality.

## Proposed SLOs

Measured over a rolling 28-day window.

| # | Objective | SLI | Target | Local floor (2026-07-19) |
|---|---|---|---|---|
| 1 | API availability | non-5xx ÷ total, from `http_requests_total` | 99.5% | 100% (0/1923 failed) |
| 2 | Read latency | P95 of `http_request_duration_seconds` on GET routes | < 800 ms | 21 ms |
| 3 | Auth latency | P95 on `/api/auth/*` | < 1.5 s | **unmeasurable — see below** |
| 4 | Match feed latency | P95 on the feed route | < 1 s cold, < 500 ms cached | 16 ms / 15 ms (empty feed) |
| 5 | Report generation | P95 on `/api/v1/reports/*` | < 5 s | not yet measured |
| 6 | Queue freshness | `bull_queue_depth{state="waiting"}` on `notifications` | < 100 for 95% of samples | not yet measured |
| 7 | Payment webhook success | non-5xx on the Razorpay webhook route | 99.9% | not yet measured |

The **local floor** column is the first real measurement of this system, from
`perf/BASELINE.md` (2026-07-19, k6 v0.54.0). Read it as a floor and nothing
more: load generator, API and database were one machine over loopback, so it
excludes network RTT, TLS, the Railway proxy hop and pool contention. It does
not validate the targets — it only establishes that none of them is violated
by the application logic alone, which is a weaker and more honest claim.

The headroom is large (21 ms against an 800 ms target), and that is exactly
what makes these targets still **uncalibrated**: a target with 38x headroom
cannot tell you whether it is right, only that it is not obviously wrong. The
first month of production traffic remains the calibration period.

Notes on the ones that differ most from the rest:

- **#3 cannot be measured from a single host.** Better Auth rate-limits OTP
  sends to 3 per 10-minute window keyed by **source IP**, so a load generator
  gets 429s rather than latency. Calibrating it needs distributed load or a
  perf environment with the limiter relaxed. Do not relax it anywhere
  user-facing.
- **#4's local number is a floor, not a figure.** The seeded QA user's feed
  returns zero items, so payload assembly and scoring are not in it.
- **#5 is deliberately loose.** PDF rendering is synchronous CPU work, so seconds are
  expected, not a defect. Tighten it only after rendering moves to a queue.
- **#7 is stricter than availability.** A dropped webhook desynchronises payment state
  from Razorpay, which is a money-correctness problem rather than an availability one.

## What should page

Alert on **symptoms users feel**, not on causes. Route via BetterStack (see
`docs/monitoring/betterstack-setup.md`).

### Page immediately

| Condition | Why |
|---|---|
| `/ready` returns 503 for > 2 min | Postgres or Redis is down — effectively a full outage |
| 5xx rate > 5% for 5 min | Users are seeing failures now |
| Payment webhook 5xx, any sustained rate | Money state diverging from Razorpay |
| `circuit_breaker_state{service="razorpay"} == 2` for > 5 min | Payments failing outright |
| `process_uptime_seconds` repeatedly resetting | Crash loop |

### Warn (working hours)

| Condition | Why |
|---|---|
| P95 latency above target for 15 min | Degrading before it breaks |
| `bull_queue_depth{state="waiting"}` > 500 for 10 min | Workers falling behind |
| `circuit_breaker_state == 1` (half-open) recurring | A provider is flapping |
| `process_memory_rss_bytes` monotonically rising over 24h | Probable leak |
| Error-budget burn > 2× the sustainable rate | On track to miss the SLO |

### Deliberately not alerted

- **Individual job failures.** Bull already retries 5× with exponential backoff; alerting
  on a single failure is noise. Alert on depth and on the dead-letter set instead.
- **A single circuit-breaker trip.** That is the breaker doing its job. Sustained-open is
  the signal.
- **Mongo unavailable while `USE_MOCK_SERVICES=true`.** Expected in mock mode.

## Health endpoints

- **`GET /health`** — liveness. Returns 200 whenever the process is up. Never gate a
  restart on anything richer; that turns a dependency blip into a restart storm.
- **`GET /ready`** — readiness. Checks Postgres, Redis and Mongo, each behind a 2s
  timeout (Sprint H) so a hung dependency fails fast rather than hanging the probe, and
  reports queue depth alongside. 503 only when a *required* dependency (Postgres, Redis)
  is down.

Point the load balancer at `/ready` and the restart policy at `/health`.

## Calibration checklist

Once real traffic exists:

1. Export a week of `http_request_duration_seconds` and read the actual P50/P95/P99 per route.
2. Replace every target above with something derived from those percentiles.
3. Delete any SLO nobody has looked at — an unused objective is overhead.
4. Record the k6 baseline in `perf/README.md` and re-run it before each release.

## Related

- `docs/monitoring/betterstack-setup.md` — monitor/alert wiring
- `docs/handover/SCALING-PLAYBOOK.md` — capacity model and the signals to watch
- `docs/RUNBOOK.md` — what to actually do when one of these fires
- `perf/README.md` — load scripts and baseline
