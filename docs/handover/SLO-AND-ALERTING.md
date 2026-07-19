# SLOs and Alerting

> Phase 8 Sprint H (Unit 8.3). Service level objectives, the metrics behind them, and
> what should page a human.

## Status: proposed, not yet calibrated

These targets are **proposed**, chosen from what the endpoints ought to achieve given
their work — not from measured production behaviour, because there isn't any yet. Treat
the first month of real traffic as the calibration period.

> **Updated 2026-07-19.** K6 baseline now measured (2026-07-19, commit `6ab796b`).
> See `perf/BASELINE.md` for full run metadata. **Critical caveat:** all numbers are
> **local loopback only** (API + database on one machine, zero network RTT, no TLS,
> no Railway proxy). They rule out gross application slowness and serve as a regression
> tripwire. They do NOT validate SLO targets — a production P95 will be substantially
> higher (exact gap unknown without staging traffic). Treat all measured p95s below
> as **floors, not ceilings**.

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
| 1 | API availability | non-5xx ÷ total, from `http_requests_total` | 99.5% | 100% (0/1923 failed) · k6 smoke: 843 vendor + 746 feed + 334 analytics requests, 0 failures |
| 2 | Read latency | P95 of `http_request_duration_seconds` on GET routes | < 800 ms | **21 ms** (vendor list/filtered/pagination p95, `perf/vendors.js`) — see note below |
| 3 | Auth latency | P95 on `/api/auth/*` | < 1.5 s | **unmeasurable — see below** |
| 4 | Match feed latency | P95 on the feed route | < 1 s cold, < 500 ms cached | **16 ms** (p95, seeded QA user, empty feed floor; `perf/feed.js`) · no payload assembly measured |
| 5 | Report generation | P95 on `/api/v1/reports/*` | < 5 s | **38 ms** (admin stats endpoint p95; `perf/analytics.js`) · PDF rendering not measured (sync, queued for batches) |
| 6 | Queue freshness | `bull_queue_depth{state="waiting"}` on `notifications` | < 100 for 95% of samples | **not measured** (would need job dispatcher load; see calibration checklist) |
| 7 | Payment webhook success | non-5xx on the Razorpay webhook route | 99.9% | **not measured** (webhook stress test deferred; Razorpay rate-limits inbound, not our bottleneck) |

The **local floor** values are from `perf/BASELINE.md` (2026-07-19, k6 v0.54.0, commit `6ab796b`).
Read them as floors only: load generator, API and database were one machine over loopback, so they
exclude network RTT, TLS, the Railway proxy hop, connection-pool pressure, and cold-start behaviour.
They establish that application logic does NOT violate the targets; they do not validate whether
the targets themselves are right. The headroom is large (21 ms against an 800 ms target), which means
these targets remain **uncalibrated**: a target with 38x headroom cannot tell you whether it is right,
only that it is not obviously wrong. The first month of production traffic remains the calibration period.

**Rows marked unmeasured must be calibrated from staging/production**, not from this loopback run.

Notes on measured vs unmeasured:

- **#1:** ✅ Measured (0 failures over 1923 loopback requests across three scenarios).
- **#2:** ✅ Measured (vendor list queries, all pagination depths). Represents pure query cost.
- **#3 cannot be measured from a single host.** Better Auth rate-limits OTP sends to 3 per 10-minute
  window keyed by **source IP**, so a load generator on one host gets 429s, not latency. Needs
  distributed load from multiple IPs or a staging environment with the limiter relaxed (never
  relax on user-facing). Marked **unmeasurable**.
- **#4 is a floor, not a figure.** The seeded QA user's feed returns zero profiles, so payload assembly,
  scoring, and sorting are not measured. Represents auth + query baseline only. A real user's feed
  (with 10–100 matches) will show true latency. Marked as measured but with the caveat.
- **#5 measured on stats endpoint, not PDF rendering.** PDF creation is synchronous CPU work (seconds expected).
  The analytics stats endpoint (which feeds dashboards) shows the true API cost; PDF generation is queued
  for production batches. Row marked **not measured** for the PDF path itself.
- **#6 queue depth:** Requires injecting load into the job system (outbound notifications, emails, SMS).
  Without that load, a queue depth measurement is 0. Marked **not measured** (needs dispatcher load).
- **#7 webhook stress:** Razorpay rate-limits inbound webhook sending at ~100/sec; we do not rate-limit
  inbound. Webhook success depends on Razorpay sending reliable, idempotent payloads (their SLA).
  Our job: idempotency + audit trail (verified). Webhook throughput is Razorpay-bounded, not our bottleneck.
  Marked **not measured** (Razorpay controls the load, not our test suite).

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
