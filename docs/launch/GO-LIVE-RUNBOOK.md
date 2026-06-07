# Go-Live Runbook — Smart Shaadi

> **Purpose:** the ordered launch-day procedure. Follow top to bottom. Every step
> has an **action**, a **verify**, and a **rollback**. Do not advance to step N+1
> until step N's verify is green.
>
> **Prerequisite:** every **Section A — BLOCKER** in `LAUNCH-CHECKLIST.md` is DONE.
> If any is still OPEN, stop — this runbook does not start.
>
> **Golden rule** (from `mock-to-real-swap.md`): flip `USE_MOCK_SERVICES=false`
> **last**. Bring each backend live individually first so a bad credential is
> isolated to one provider, not the whole API.
>
> **Companion:** `mock-to-real-swap.md` holds the per-provider env vars + the exact
> verify prose. This runbook sequences them and adds rollback + the 24h watch.

---

## Step 0 — Pre-flight

**Action**
- Confirm `LAUNCH-CHECKLIST.md` Section A is all-DONE (GO, not NO-GO).
- Take a Railway Postgres backup: Dashboard → Postgres → Data → Backups →
  **"Create backup now"**. This is the safety net for Step 1.
- Snapshot current Railway + Vercel env vars (copy to a scratch note) so Step 2's
  rollback can restore the exact prior state.
- Confirm `MOCK_OTP_VALUE` is currently set (needed only while mock master is on;
  removed in Step 2).

**Verify** — backup shows in Railway backups list; env snapshot saved.

**Rollback** — N/A. If any Section A item is still open, **abort the launch**.

---

## Step 1 — Reconcile migration drift

> Only if not already done as blocker A4. `0028` (calendar_events) + `CREATE
> EXTENSION vector` were applied to prod outside `drizzle-kit migrate`, so they are
> missing from `__drizzle_migrations`.

**Action**
- Journal both via psql / Railway SQL console (Data tab → Query). **Never
  `drizzle-kit push`** against prod — Better Auth PK 42P16 hazard (CLAUDE.md).
- `0028_sturdy_next_avengers.sql` is idempotent (`IF NOT EXISTS`) — safe to re-run
  if needed. See `docs/MIGRATIONS-PENDING.md`.

**Verify** — `SELECT * FROM __drizzle_migrations` shows rows covering `0028` + the
vector extension; `SELECT * FROM pg_extension WHERE extname='vector'` returns a row.

**Rollback** — additive-only; no data touched. If journaling errors, leave the
drift doc as-is and resolve before continuing — do not proceed to Step 2 with an
unreconciled schema.

---

## Step 2 — Flip env to real (the cutover)

**Action** (Railway API + Vercel web, then redeploy)
- Bring backends live individually first and verify (Step 3) — but the env values
  go in here:
  - `MONGO_LIVE=true`, `R2_LIVE=true`
  - Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
    (or `RAZORPAY_WEBHOOK_SECRETS=current,previous`); `NEXT_PUBLIC_RAZORPAY_KEY_ID`
    on Vercel.
  - MSG91: `MSG91_API_KEY`, `MSG91_SENDER_ID`/template ids.
  - SES: real AWS SES creds.
  - `METRICS_TOKEN` set (required by real-mode guard).
  - **`KYC_LIVE` left UNSET** — KYC stays mocked → `MANUAL_REVIEW` (Checklist §C).
  - `ALLOW_MOCK_SERVICES_IN_PROD` **unset**; remove `MOCK_OTP_VALUE` from prod.
- **Then flip the master last:** `USE_MOCK_SERVICES=false` (Railway + Vercel).

**Verify** — API boots clean: no `env.ts` superRefine exit (would mean a missing
cred). `GET /health` 200. `GET /ready` 200.

**Rollback** — restore the Step 0 env snapshot (set `USE_MOCK_SERVICES=true`,
re-add `MOCK_OTP_VALUE`), redeploy. All providers revert to stubs in one move. If
only one provider is bad, prefer the per-provider rollback in Step 3 instead.

---

## Step 3 — Verify each provider

> Use the exact verify prose in `mock-to-real-swap.md`. Per-provider rollback keeps
> a single bad credential from forcing a full revert.

**Action / Verify**
- **MongoDB** — save a profile section, re-fetch in a new request → persists (not
  stale mock JSON). Rollback: unset `MONGO_LIVE`.
- **R2** — request an upload URL, PUT a file, GET it back via the photo URL.
  Rollback: unset `R2_LIVE`.
- **MSG91** — request an OTP to a real handset → delivered + login works. Rollback:
  re-enable mock (`USE_MOCK_SERVICES=true` + `MOCK_OTP_VALUE`).
- **Razorpay** — send a test event to **both** endpoints →
  `POST /api/v1/payments/webhook` and `POST /api/v1/store/webhook/razorpay` → each
  HTTP 200 + `webhook_events` row PROCESSED. Bad-signature → 400 (payments) / 401
  (store). Rollback: revert Razorpay keys, keep other providers live.
- **KYC (confirm still mocked)** — submit a KYC → lands in `MANUAL_REVIEW`, does
  **not** throw. Confirms `KYC_LIVE` is correctly unset.

**Rollback** — per-provider as listed; isolate the failing one.

---

## Step 4 — Re-run health check

**Action** — `pwsh scripts/health-check.ps1 -Env prod`.

**Verify** — exit 0; all four targets 200 and **not** SKIPPED: api `/health`, api
`/ready`, web `/`, **ai-service `/health`** (requires `AI_SERVICE_HEALTH_URL` —
blocker A5).

**Rollback** — investigate the failing target before proceeding. Do not announce
with a red health check.

---

## Step 5 — Browser smoke on prod

**Action** — full path on `smartshaadi.co.in`: signup → OTP → profile → match →
chat → booking → pay. Plus a mocked KYC submission landing in `MANUAL_REVIEW`.

**Verify** — no 500s from Server Components, console clean, network tab no errors.
A real OTP arrives, a real payment processes, webhook marks PROCESSED.

**Rollback** — if any flow 500s: flip `USE_MOCK_SERVICES=true` (full revert) or set
`ALLOW_MOCK_SERVICES_IN_PROD=true` for degraded mode while debugging, then redeploy.

---

## Step 6 — Announce / open registrations

**Action** — only after Steps 1–5 are all green. Open public signups / announce.

**Verify** — first real external users complete signup + OTP successfully.

**Rollback** — pause new signups (or revert to mock) if Step 7 thresholds breach.

---

## Step 7 — First-24h watch list

Monitor continuously for the first 24 hours. Each signal has a **rollback trigger**.

| Signal | Source | Watch | Rollback trigger |
|--------|--------|-------|------------------|
| Error rate / new issues | Sentry (api, web, ai-service) | spike above baseline, any new high-frequency issue | sustained 5xx spike → flip to mock/degraded, debug |
| Signup funnel + OTP success | PostHog | signups landing, OTP-success ratio | OTP failure > ~10% → check MSG91 / DLT template, consider pause |
| API + ai-service liveness | `/ready`, ai-service `/health` (periodic) | both 200 | repeated non-200 → investigate before more traffic |
| Razorpay webhook health | `webhook_events` PROCESSED vs FAILED | PROCESSED ratio high | rising FAILED → check signature/secret, revert Razorpay keys |
| Queue / Redis depth | Bull queues, Redis | notification/email/SMS backlog draining | unbounded backlog → scale workers / investigate |

**General rollback:** the one-move full revert is `USE_MOCK_SERVICES=true` (re-add
`MOCK_OTP_VALUE`), redeploy — every provider returns to stub. Use per-provider
reverts (Step 3) when only one backend is misbehaving.

---

## One-page summary

```
0. Pre-flight     — Section A all DONE; backup; snapshot env
1. Migration      — journal 0028 + vector (psql/console, NEVER drizzle-kit push)
2. Flip env       — providers live + USE_MOCK_SERVICES=false (last); KYC_LIVE unset
3. Verify each    — Mongo · R2 · MSG91 · Razorpay (both webhooks) · KYC=MANUAL_REVIEW
4. Health check   — health-check.ps1 -Env prod → exit 0, all 4 incl. ai-service
5. Browser smoke  — full prod path, no 500s
6. Announce       — only after 1–5 green
7. Watch 24h      — Sentry · PostHog · health · webhooks · queues (+ rollback triggers)
```
