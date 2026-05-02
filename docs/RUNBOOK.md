# Smart Shaadi — Incident Runbook

> **Purpose.** Step-by-step response procedures for the top 5 incident scenarios.
> **Owner:** Ashwin Hingve (single-developer on-call) · **Pager:** Sentry → email/SMS

---

## Severity legend

| Sev | Definition | Response time |
|-----|-----------|---------------|
| SEV-1 | User-visible payment / signup outage; data loss risk | < 5 min |
| SEV-2 | Feature degraded but workaround exists | < 30 min |
| SEV-3 | Background process failing; no user impact | < 4 hr |
| SEV-4 | Cosmetic / cleanup | next business day |

---

## Incident 1 — Razorpay webhook flood

**Signal.** Sentry alert "high webhook volume" + `bull:notifications:wait` queue depth spiking.

**Likely cause.** Razorpay retries on 5xx responses; if our webhook handler errors, retries amplify the load. Or: legitimate test traffic spike from Razorpay's reconciliation sweep.

**Response.**

1. **Verify scale.** `redis-cli LLEN bull:notifications:wait` — if > 5000, spike is real.
2. **Check error rate.** Sentry → filter `event:webhook AND level:error` last 1h. If > 5% of requests, our handler is failing.
3. **Identify failure.** Last 100 errors → look for common pattern. Most likely:
   - DB connection pool exhausted → restart api: `railway service restart api`
   - Specific event type crashing → temporarily mark that event ignored:
     ```
     # in apps/api/src/payments/webhook.ts
     # add early-return for the offending event.event type
     # deploy + monitor
     ```
4. **If overwhelmed.** Pause webhook event processing (let Razorpay retries queue):
   - Block at edge: in Railway dashboard, set `RAZORPAY_WEBHOOK_PAUSED=true`
   - api respects this flag (returns 503 — Razorpay queues for re-delivery)
5. **Resolve.** After fix, unset flag. Razorpay's retry buffer is 24h — drained queue catches up.

**Prevention.** Idempotency table is already in place (`webhookEvents.ts`). Replay-protected.

---

## Incident 2 — Escrow release stuck

**Signal.** Bull `escrow-release` queue has jobs stuck in `failed` state OR escrow status stuck in `RELEASE_PENDING` for > 1h.

**Likely cause.** Razorpay payout API failed (insufficient RazorpayX balance, recipient bank account closed, regulatory hold).

**Response.**

1. **Identify stuck job.** `redis-cli LRANGE bull:escrow-release:failed 0 10`
2. **Check escrow row.** `SELECT * FROM escrow_accounts WHERE status = 'RELEASE_PENDING' AND created_at < now() - interval '1 hour'`
3. **Inspect Razorpay payout** in Razorpay dashboard for the corresponding escrowId. Three outcomes:
   - **Failed (insufficient balance).** Top up RazorpayX virtual account, then retry the Bull job.
   - **Failed (bank account invalid).** Vendor must update bank details; mark escrow `DISPUTED` and route to admin review.
   - **Stuck "processing" > 24h.** Open Razorpay support ticket with payout ID.
4. **Manual recovery.** If safe to retry: `BullMQ` admin UI → retry job. The CAS guard means the second invocation re-checks status; safe.
5. **If lost.** Escrow stays in `RELEASE_PENDING` indefinitely without harm (funds remain in our RazorpayX account). Vendor sees "payout pending" UI.

**Prevention.** CAS guard at `escrowReleaseJob.ts:68-90` prevents double-pay. Daily reconciliation cron flags drift.

---

## Incident 3 — MongoDB Atlas down

**Signal.** Sentry alerts "MongooseServerSelectionError" / connection timeouts. `/ready` returns 503 with `mongo: unreachable`.

**Likely cause.** Atlas maintenance, network partition, or quota exceeded.

**Response.**

1. **Check Atlas dashboard.** https://cloud.mongodb.com → status of our cluster.
2. **If maintenance window.** Atlas pre-announces; check email. Pause non-critical writes:
   - In Railway, set `READONLY_MONGO=true`
   - api respects this flag (mock-fallback path activates for ProfileContent + Chat reads)
3. **If unexpected outage.**
   - Failover to secondary if primary is down (Atlas auto-handles in M10+ tier; our M0 free tier is single-node — manual failover not possible).
   - Most chat / profile content writes can buffer in Redis (24h max via existing notifications queue path). Profile-heavy reads degrade to "preferences not loaded" UI.
4. **Mock fallback.** The `USE_MOCK_SERVICES` codepath includes mock-store for `ProfileContent` + `Chat` (apps/api/src/lib/mockStore.ts). Setting `MOCK_MONGO_ONLY=true` keeps real Postgres but mocks Mongo.
5. **Resolve.** Atlas-side fix; clear `READONLY_MONGO` flag.

**Prevention.** Upgrade to M10 paid tier with replica set (post-launch); current M0 free tier has no SLA.

---

## Incident 4 — ai-service unreachable

**Signal.** Sentry alert "AI_SERVICE_TIMEOUT" or `/ready` on api shows ai-service check fail. Matchmaking shows blank Guna scores.

**Likely cause.** ai-service container OOM (torch is heavy), Railway region issue, or X-Internal-Key mismatch.

**Response.**

1. **Quick check.** `curl https://ai.smartshaadi.co.in/health` from anywhere — if 200, service is up. Try `/ready` — if 503, calculator broken.
2. **Common causes:**
   - **OOM.** Railway logs show "container killed (OOM)". Bump memory: `railway service update ai-service --memory 1024`.
   - **Bad deploy.** Sentry shows recent deploy errors. Roll back: `railway service rollback ai-service`.
   - **Auth misconfig.** api logs show 401 from ai-service. Verify `AI_SERVICE_INTERNAL_KEY` matches on both Railway services.
3. **Graceful degradation.** Matchmaking has a fallback in `apps/api/src/matchmaking/scorer.ts`: if ai-service is unreachable, returns scores **without** Guna component (degraded but functional).
4. **Resolve.** Fix root cause + redeploy.

**Prevention.** /ready probe + auto-restart configured in railway.toml. Monitoring via BetterStack on `/health`.

---

## Incident 5 — Redis unreachable

**Signal.** Sentry alert "ECONNREFUSED redis" or `/ready` shows `redis: unreachable`. Bull queues stop processing. Sessions fail (cache layer).

**Likely cause.** Redis node restart, network partition, or connection limit hit.

**Response.**

1. **Check Railway Redis.** Railway dashboard → Redis service status.
2. **Restart Redis if stuck.** `railway service restart redis` (Railway-managed Redis is managed but supports restart).
3. **Fall-back behavior.** Sessions go through Postgres-backed Better Auth path automatically (slower, ~150ms vs ~5ms cached). Bull queues pause until Redis recovers; jobs resume from where they left.
4. **Connection limit.** If "max clients reached", restart api + ai-service to drop their connections. Bump Redis tier.
5. **Resolve.** Wait for Redis to recover; queue backlog drains automatically.

**Prevention.** AOF persistence enabled; jobs survive Redis restart.

---

## On-call procedure

When paged:

1. **Acknowledge** the page within 5 min (Sentry "claim" or reply to email).
2. **Triage severity.** Use the legend above.
3. **Open the incident channel** (Slack #incidents — set up post-launch).
4. **Apply runbook** for the matching scenario; if novel, document while resolving.
5. **Post-incident.** Within 24h:
   - Root cause analysis in `docs/incidents/YYYY-MM-DD-slug.md`
   - Update this runbook if a new pattern emerges
   - File preventive PR if there's a code-level fix

---

## Escalation contacts

| Layer | Contact | When |
|-------|---------|------|
| Application | Ashwin (developer) | always |
| Razorpay | merchant support, KYC team | payment-specific |
| Railway | https://railway.app/help | infra-only |
| AWS | account support | SES / Rekognition |
| MongoDB Atlas | support@mongodb.com | DB outage |
| Cloudflare | dashboard ticket | R2 / DNS |

---

## Manual recovery commands (cheat sheet)

```bash
# Drain Bull queue
redis-cli LLEN bull:<queue>:wait
# Force-fail stuck jobs
redis-cli LRANGE bull:<queue>:active 0 -1

# Postgres connection check
psql $DATABASE_URL -c "SELECT 1;"

# Restart Railway services
railway service restart api
railway service restart ai-service
railway service restart redis

# Check most recent api errors
railway logs api --tail 100 | grep -i error

# Reset escrow stuck > 1h to HELD (manual unstick)
psql $DATABASE_URL -c "UPDATE escrow_accounts SET status='HELD' \
   WHERE status='RELEASE_PENDING' AND created_at < now() - interval '1 hour' \
   RETURNING id;"
# Then re-enqueue: pnpm tsx scripts/enqueue-escrow-release.ts <escrowId>

# Verify audit chain integrity (sanity check)
pnpm tsx scripts/verify-audit-chain.ts <entityId>
```

---

## Acceptance criteria — runbook is "ready"

- [ ] All 5 scenarios above link to actual code paths
- [ ] Manual recovery commands tested at least once on staging
- [ ] Sentry alerts wired with the right severity
- [ ] BetterStack uptime alerts firing correctly
- [ ] Each escalation contact has a verified email/phone
- [ ] Post-incident template (`docs/incidents/_template.md`) exists
