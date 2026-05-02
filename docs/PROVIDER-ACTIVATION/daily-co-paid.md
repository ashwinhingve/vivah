# Daily.co (Paid Plan) — Activation Runbook

---

## What it does in vivahOS

Video calls between matched users (after both accept):
- Scheduled rooms (created at request time, valid until session end)
- Real-time video + audio
- Optional recording (consent-gated)
- Waiting room + lobby controls
- Session metadata captured for safety review

Code reference: `apps/api/src/lib/dailyco.ts`, `apps/api/src/chat/socket/handlers.ts`.

---

## Lead time

**1 day.** Daily.co is self-serve — sign up + plan upgrade + API key in same hour.

---

## What we need from the client

### Account
- [ ] Sign up at https://dashboard.daily.co
- [ ] Use `video@smartshaadi.co.in`
- [ ] Verify email

### Plan upgrade
- [ ] Current free tier: 10k participant-minutes/month, no recordings
- [ ] **Recommended plan: Scale ($99/mo)** — 50k participant-minutes, recordings, custom domain support, HIPAA-grade encryption
- [ ] Add payment method (international card needed)

### Settings
- [ ] **Custom subdomain.** Set to `meet.smartshaadi.co.in` (requires CNAME in DNS)
- [ ] **Recording storage.** Either Daily-hosted (included) or our R2 bucket via webhook (preferred — full control)
- [ ] **Default room properties.**
  - Max participants: 2 (matched pair only)
  - Recording: opt-in
  - Lobby: enabled (host approves)
  - Auto-end after 60 min
  - No screen share (privacy)

### Hand over to developer
- [ ] **`DAILY_CO_API_KEY`**
- [ ] **`DAILY_CO_DOMAIN`** = `meet.smartshaadi.co.in`
- [ ] **Recording webhook** registered → `https://api.smartshaadi.co.in/api/v1/video/recording-event`

---

## What we configure on switch-on day

```bash
# 1. Env vars
railway env set DAILY_CO_API_KEY=xxxxx
railway env set DAILY_CO_DOMAIN=meet.smartshaadi.co.in

# 2. Flip mock
railway env set USE_DAILY_MOCK=false
# (Note: env.ts already has superRefine that requires real DAILY_CO_API_KEY when mock=false)

# 3. Deploy + smoke
git push origin main
pnpm test:provider:daily -- --live
# Creates room, joins as developer, ends, asserts cleanup. ~30s end-to-end.

# 4. Verify deterministic Redis room storage works
# Existing video tests pass against real Daily.co (not just mock)
```

---

## Rollback

```bash
railway env set USE_DAILY_MOCK=true
# Mock returns smartshaadi.daily.co URLs — UX same, no real video
```

---

## Cost model

| Plan | Monthly | Includes |
|------|---------|----------|
| Free | $0 | 10k min, no recording |
| Pro | $9 | 100 min/host/mo |
| Scale | $99 | 50k min, recording, custom domain |
| Enterprise | $999+ | unlimited, SLA |

At 10k MAU with 5% using video monthly @ 20 min avg = 10k min — within Free, but Scale recommended for the recording + custom domain features.

---

## Critical privacy note

Recordings are sensitive — both participants must consent before recording starts. Our flow:
1. Participant A starts call → no recording
2. Either participant clicks "Record" → other gets a consent prompt
3. Both confirm → recording starts; visible indicator stays on
4. Either party can stop recording; both notified
5. Recording stored in our R2 bucket (encrypted at rest), TTL 30 days, auto-deleted unless flagged for safety review

---

## Failure modes & responses

| Failure | Detection | Response |
|---------|-----------|----------|
| Token expired mid-call | Daily SDK error | Refresh token; rejoin |
| Browser blocks camera | Frontend error | Show permission instructions |
| Recording webhook missed | Reconcile cron | Re-fetch recording metadata from Daily REST API |
| Plan limits hit | Daily emails warning at 80% | Upgrade plan or rate-limit new rooms |

---

## Why this is fast

Self-serve, no human gating. Daily.co is the simplest provider in the kit.
