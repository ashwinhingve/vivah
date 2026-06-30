# First-24h Monitoring Plan — Smart Shaadi

> **Purpose:** the detailed watch + rollback plan for the first 24 hours after
> public launch. The `GO-LIVE-RUNBOOK.md` **Step 7** table is the one-glance view;
> this doc is the full plan — thresholds, rollback triggers, escalation, and the
> post-launch follow-ups that are tracked but do **not** block the first 24h.
>
> **Window:** continuous watch starting the moment **Step 6 — Announce** opens
> public signups, for 24 hours.
> **Owner:** Ashwin (engineering). Colonel Deepak on call for external-registration
> issues (DLT template rejection, Razorpay account holds).
>
> **Companion:** `GO-LIVE-RUNBOOK.md` (the ordered launch steps),
> `mock-to-real-swap.md` (per-provider verify + rollback one-liners),
> `../monitoring/betterstack-setup.md` (uptime monitors), `../RUNBOOK.md`
> (incident procedures: webhook recovery, queue depth, payout stuck).

---

## What to watch

Establish a baseline in the first ~30 minutes of real traffic, then watch for
deviation. "Baseline" = the steady-state rate once the first handful of real users
have flowed through signup → OTP → match → pay.

### 1. Sentry — error rate / new issues

- **Sources:** api, web, ai-service (all three wired — Phase 4 Day 2).
- **Watch:** overall 5xx / unhandled-exception rate vs the 30-min baseline; any
  **new** high-frequency issue that did not exist pre-launch.
- **Healthy:** no new issue climbing the "most frequent" list; error rate flat.
- **Rollback trigger:** a sustained 5xx spike (well above baseline, not a one-off)
  → see Rollback triggers below.

### 2. PostHog — signups + funnel + OTP success

- **Watch:** signups landing at all (funnel entry), drop-off between funnel steps,
  and the **OTP-success ratio** (OTP requested → login completed). OTP is the
  canary for MSG91/DLT health (see the coupling note in the runbook).
- **Healthy:** OTP success ≳ 90%; funnel drop-off within normal bounds.
- **Rollback trigger:** OTP failure **> ~10%** → MSG91 / DLT template problem.

### 3. Railway logs — API + ai-service

- **Watch:** API and ai-service boot logs (no `env.ts` superRefine exit, no restart
  loop) and runtime 5xx / unhandled rejections.
- **Healthy:** clean boot, no crash-restart cycle.
- **Rollback trigger:** repeated boot failure → a required cred is missing; restore
  the Step-0 env snapshot.

### 4. BullMQ / Redis — queue depth

- **Watch:** notification / email / SMS queue depth — backlog should **drain**, not
  grow unbounded. Redis memory steady.
- **Healthy:** queues near-empty between bursts; jobs completing.
- **Rollback trigger:** unbounded backlog → scale workers / investigate stuck jobs
  (`../RUNBOOK.md` queue-depth procedure).

### 5. Razorpay — webhook delivery

- **Watch:** `webhook_events` PROCESSED vs FAILED ratio across **both** endpoints —
  `POST /api/v1/payments/webhook` and `POST /api/v1/store/webhook/razorpay`.
- **Healthy:** PROCESSED ratio high; FAILED near zero.
- **Rollback trigger:** rising FAILED ratio → signature/secret mismatch; revert
  Razorpay keys (per-provider, keep other backends live — runbook Step 3).

### 6. Liveness — health endpoints

- **Watch:** periodic probe of api `/ready` and ai-service `/health` (api `/health`
  + web `/` also covered by the BetterStack monitors, 3-min checks).
- **Healthy:** all 200.
- **Rollback trigger:** repeated non-200 on `/ready` or ai-service `/health` →
  investigate before letting more traffic in.

> Re-run `pwsh scripts/health-check.ps1 -Env prod` at any point for a one-shot
> matrix across all four targets.

---

## Rollback triggers (summary)

| Trigger | Threshold | Action |
|---------|-----------|--------|
| 5xx / error spike | sustained, well above baseline | full revert or degraded mode (below); debug via Sentry |
| OTP failure | > ~10% | check MSG91 creds / DLT template; consider pausing signups (Colonel on DLT) |
| Razorpay webhook FAILED | rising ratio | revert Razorpay keys (per-provider, Step 3); verify webhook secret |
| Queue backlog | unbounded growth | scale workers / clear stuck jobs (`../RUNBOOK.md`) |
| Boot failure | API won't start | a required cred missing → restore Step-0 env snapshot |

**One-move full revert:** set `USE_MOCK_SERVICES=true`, re-add `MOCK_OTP_VALUE`,
redeploy → **every** provider returns to stub. Use this when more than one backend
is implicated or the cause is unknown.

**Degraded mode:** set `ALLOW_MOCK_SERVICES_IN_PROD=true` to keep prod up with
mocks while debugging (auth/KYC/payment routes return 500 at request time, boot
logs warn). Remove it the moment the fix lands.

**Per-provider revert:** when only one backend misbehaves, use the targeted
rollback from runbook **Step 3** (e.g. unset `MONGO_LIVE`, revert Razorpay keys)
instead of a full revert — keeps the rest of the platform live.

---

## Escalation

- **Engineering issue** (5xx, boot failure, webhook signature, queue stall) →
  **Ashwin** acts immediately; apply the matching rollback trigger above, then debug.
- **External-registration issue** (DLT template rejected/throttled, Razorpay account
  hold, OTP undeliverable despite correct creds) → **Colonel Deepak** — these need
  the vendor account owner, not a code change.
- **When to escalate / wake someone:** a rollback trigger breaches **and persists**
  past a short confirmation window (i.e. not a transient blip). A single failed
  webhook or one OTP miss is not an incident; a rising ratio is.
- During the 24h window, prefer pausing new signups (runbook Step 6 rollback) over
  letting a degrading signal compound while debugging.

---

## Post-launch items (tracked, not 24h-blocking)

These do not gate the first 24h and are not rollback triggers — they are the
follow-up backlog once the launch is stable.

- **AI service** — re-confirm `AI_SERVICE_HEALTH_URL` is still set in Railway and
  the ai-service is responding; **redeploy** if it has drifted/stopped (it is a
  launch gate per checklist A5/B4 + runbook Step 4, but if it falls over
  post-launch the API degrades gracefully — AI features only).
- **KYC** — flip `KYC_LIVE=true` once DigiLocker registration lands, moving KYC off
  the `MANUAL_REVIEW` mock path (`mock-to-real-swap.md` step 4; checklist §C3).
  Until then admin `approveKyc` handles verification manually — intentional.
- **BetterStack** — add an ai-service monitor (the free tier currently has none;
  ai-service liveness in prod is otherwise only covered by `health-check.ps1` and
  the periodic probe above). See `../monitoring/betterstack-setup.md`.
