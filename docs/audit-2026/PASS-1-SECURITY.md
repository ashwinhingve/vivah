# Smart Shaadi — Audit PASS 1: Security & Data Integrity

> **READ-ONLY audit. Nothing was fixed.** This document records findings only.
> Each carries `file:line`, a severity, and a one-line proof/repro. Remediation is
> **deferred** to an explicitly-authorised fix pass (audit and fix stay separated).
> Companion file: `PASS-1-FINDINGS.md` (holds the ai-service joblib finding
> **P1-001**) — cross-referenced here, not duplicated. Ground truth: `PASS-0-INVENTORY.md`.

**Date:** 2026-07-26 · **Branch:** `feat/virtual-date-lifecycle-hardening` · **Scope:** the seven areas below.

**Severity scale**
- **P0** — exploitable / data-loss / active data exposure **now**.
- **P1** — serious: a real security or integrity defect, exploitable or latent-but-fragile.
- **P2** — hygiene / correctness with limited blast radius.
- **P3 / info** — recorded for completeness; not a defect to fix.

**Method.** Seven read-only evidence-gatherers fanned out (one per area: A tenant
isolation · B authz-on-mutation · C PII · D TOCTOU races · E webhooks/SSRF ·
F secrets/storage · G audit-log integrity). **Every P0/P1 claim was then
re-verified first-hand against source** before entering this report — subagent
findings in this repo have a track record of over- and under-statement, and for a
security pass a wrong severity is as costly as a missed bug. That verification
changed the picture materially (see §2). Where a finding says *"verified
first-hand,"* the cited lines were re-opened and the logic re-derived directly.

---

## 1. Headline

**No P0 confirmed.** The highest-stakes mechanisms are genuinely solid, verified
first-hand: Razorpay webhook signature + raw-body + idempotency, the booking
double-book partial-unique index, the SSRF/DNS-rebinding guard, and
authorization on 100+ mutations. The closest thing to P0 is a clean,
trivially-exploitable **IDOR on the FII score endpoint (P1-S1)**. The money-path
"double-refund" transitions flagged as P0 during fan-out are **real races but
P1**, because actual double-execution is currently blocked by *external*
backstops (Razorpay's refundable-amount cap, an atomic escrow CAS, webhook
dedup) — not by the code itself.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 6 |
| P3 / info | 4 |

---

## 2. Reclassified after first-hand verification

Why this report is not a raw dump of agent output:

| Fan-out claim | Claimed | **Verified verdict** | Reason |
|---|---|---|---|
| Booking cancel / refund "double-spend" | **P0 ×3** | **P1** (consolidated → P1-S2) | Real read-then-update, but double-payout is blocked by Razorpay's refundable-amount cap + the atomic `WHERE status='HELD'` escrow-release CAS + webhook eventId dedup. Fragile, not currently exploitable for a double payout. |
| `completeBooking` race | P1 | **P2** (→ P2-2) | The money step downstream is the atomic escrow CAS → money-safe. |
| Subscription webhook races | P0/P1 | **P2** (→ P2-2) | Webhook eventId dedup prevents same-event replay; residual is redundant cache/audit writes. |
| `/security/overview` returns email unmasked | P1 | **REJECTED → P3** | Query is `WHERE user.id = userId` — the caller's **own** account. Self-view, not a cross-tenant leak. |
| Admin/family Server Action missing client-side auth | P1/P2 | **Not a vuln (info)** | The API enforces `authorize(['ADMIN'])` / the parent-child relationship; the server is the boundary. Defense-in-depth note only. |
| KYC status change "not audited" | P1 | **Not a gap (info)** | KYC is audited via a dedicated `kyc_audit_log` table (actor / IP / UA / from→to) — richer than the chain, just not tamper-chained. |

---

## 3. Findings

| ID | Sev | Title | Area | Anchor |
|---|---|---|---|---|
| P1-S1 | **P1** | IDOR — FII score readable cross-tenant | A/C | `routes/ai.ts:1128` |
| P1-S2 | **P1** | Money-state transitions lack local atomicity (safe only by external backstop) | D | `bookings/service.ts:556`, `payments/service.ts:239` |
| P2-1 | P2 | Audit-chain hash breaks on jsonb round-trip (integrity control unreliable) | G | `jobs/auditChainVerifierJob.ts:37` |
| P2-2 | P2 | Non-money state transitions are read-then-update | D | `matchmaking/requests/service.ts:359` +… |
| P2-3 | P2 | Virtual-date NO_SHOW — doc/code mismatch + TOCTOU | D/G | `video/service.ts:322` |
| P2-4 | P2 | Audit-chain coverage gaps (block/unblock, virtual-date lifecycle) | G | `matchmaking/requests/service.ts:442` |
| P2-5 | P2 | Pino `set-cookie` not redacted | C | `lib/logger.ts:19` |
| P2-6 | P2 | Duplicated audit-hash implementation (3 copies) | G | `payments/service.ts:26` +… |

### P1-S1 — IDOR: FII score readable cross-tenant
**Sev:** P1 · **Area:** A (tenant isolation) / C (PII) · **File:** `apps/api/src/routes/ai.ts:1128-1160`

`GET /api/v1/ai/fii/score/:profileId` is authenticated and **selects
`profiles.userId` (line 1152) but never checks it**. The only guard is
`if (!profileRow)` → 404 (`:1157`). Any authenticated user can read **any**
profile's Family Inclination Score and its full breakdown by supplying that
profile's `profileId`.

- **Exploitable:** `profileId`s are handed to every user in their match feed
  (`MatchFeedItem` carries `profileId`), so an attacker doesn't need to guess UUIDs.
- **Smoking gun:** the query selects `userId` but discards it; the two sibling
  endpoints in the same file **do** enforce owner-only access
  (profile-optimizer `ai.ts:1403-1406`, marriage-readiness `ai.ts:1533-1536`).
  This is a dropped ownership check, not an intentional public endpoint.
- **Proof:** as user B, `GET /api/v1/ai/fii/score/<a-profileId-from-B's-feed>`
  → returns user A's score + breakdown. **Verified first-hand.**
- **Why P1 not P0:** the exposed data is a derived compatibility score/breakdown,
  not raw contact PII, credentials, or money — serious cross-tenant disclosure,
  but bounded. It is nonetheless the single closest finding to P0.

### P1-S2 — Money-state transitions lack local atomicity (safe only by external backstop)
**Sev:** P1 · **Area:** D (TOCTOU) · **Files:** `apps/api/src/bookings/service.ts:556-611`, `apps/api/src/payments/service.ts:229-242`

Two money paths are read-then-update with no local mutual exclusion:

- **`cancelBooking`** pre-reads `escrow?.status === 'HELD'` (`:556`, a check-then-act),
  then inside a transaction flips the escrow to `REFUND_PENDING` with **no status
  guard** (`.where(eq(escrowAccounts.id, escrow.id))`, `:586-589`), then calls
  `createRefund` *outside* the transaction (`:600-606`).
- **`requestRefund`** flips the payment to `REFUNDED` with **no status guard**
  (`:239-242`) *after* calling `createRefund` (`:236`).

Two concurrent cancels/refunds for the same booking both pass the check and both
call Razorpay. **Actual double-payout is prevented only by mechanisms external to
this code:**
1. Razorpay's server-side refundable-amount cap — a second *full* refund is rejected;
2. the **atomic** `UPDATE … WHERE status='HELD'` escrow-release CAS in
   `apps/api/src/jobs/escrowReleaseJob.ts:72-88`;
3. webhook eventId idempotency (`payments/webhookEvents.ts`).

- **Why P1 not P0:** no confirmed double-payout with today's backstops in place.
- **Why not P2:** the code has *no* local guard; the safety is entirely borrowed.
  A refactor that removes a backstop, or a **partial-refund** feature (where the
  refundable cap no longer binds a second call), turns this into a real
  double-refund. The correct fix is a conditional `WHERE status IN (…expected…)`
  + rowCount check on the escrow/payment flip. **Verified first-hand.**

### P2-1 — Audit-chain hash breaks on jsonb round-trip (integrity control unreliable)
**Sev:** P2 (*arguably P1* — see below) · **Area:** G · **Files:** write `apps/api/src/payments/service.ts:25-27,55`; verify `apps/api/src/jobs/auditChainVerifierJob.ts:37,59`; column `packages/db/schema/index.ts:1112`

The append-side computes `contentHash = sha256(JSON.stringify(payload) + prevHash)`
from the **in-memory JS object** (`service.ts:26,55`). The daily verifier reads
`payload` back **from `jsonb`** (`auditLogs.payload` is `jsonb`,
`schema/index.ts:1112`) and recomputes the same `JSON.stringify(payload)`
(`auditChainVerifierJob.ts:37,59`). Postgres `jsonb` **does not preserve object
key order or whitespace** — it stores a normalized form. So for any payload whose
keys weren't already in jsonb's canonical order, the verifier's re-stringify
differs from the write-time string, the recomputed hash diverges, and the job
raises a **false-positive `CHAIN TAMPERED` Sentry `fatal`** (`:92`).

- **Effect:** the tamper-detection control is unreliable — it cries wolf on
  legitimately-written rows, and the resulting alert fatigue masks a *real*
  tamper event. Unit tests pass because a **mocked** DB round-trips the JS object
  exactly; real Postgres does not.
- **Why flagged P2, noted arguably P1:** not exploitable and no data loss, so P2
  by the scale — but it silently defeats an integrity guarantee, so treat as P1
  if the audit chain is a compliance/assurance requirement.
- **Proof:** append an audit log with keys in non-canonical order (e.g.
  `{zeta:1, a:2}`), then run `verifyEntityChain(entityId)` against a real
  Postgres → `ok:false`. **Reasoned from documented jsonb key-normalization;
  not empirically reproduced here (local Postgres was down).**
- **Fix direction (deferred):** hash a canonical serialization (stable key order)
  on *both* sides, or store `payload` as `text` holding the exact bytes that were
  hashed, or hash the already-serialized string.

### P2-2 — Non-money state transitions are read-then-update
**Sev:** P2 · **Area:** D · **Files:** `apps/api/src/matchmaking/requests/service.ts:359` (decline), `:394` (withdraw), `:459-469` (block, bulk); `apps/api/src/payments/subscriptions.ts:212,308,331,359`; `apps/api/src/bookings/service.ts:647` (complete); `apps/api/src/video/service.ts:322` (NO_SHOW — see P2-3)

A set of status transitions update `WHERE id = ?` with no `AND status=<expected>`
guard, so concurrent requests race. Blast radius is limited and non-financial:

- **decline + accept** on the same request can both commit → a chat is created for
  a request that also reads as DECLINED (user-visible inconsistency).
- **subscription** webhook/grace transitions and **completeBooking** are
  money-*adjacent* but protected downstream (webhook eventId dedup; the atomic
  escrow-release CAS), so they degrade to redundant writes rather than money loss.

Fix direction: conditional `WHERE status=<expected>` + rowCount. **Key cases
verified first-hand; the full set sampled.**

### P2-3 — Virtual-date NO_SHOW: doc/code mismatch + TOCTOU
**Sev:** P2 · **Area:** D / G · **File:** `apps/api/src/video/service.ts:287-326`

In `sweepVirtualDateLifecycle`:
- **PROPOSED → CANCELLED is atomic** — `UPDATE … WHERE status='PROPOSED' AND
  scheduledAt < cutoff` (`:287-293`). Correct.
- **CONFIRMED → NO_SHOW is not** — the sweep SELECTs candidates
  (`WHERE status='CONFIRMED' AND …`, `:306-311`), refines them in JS by duration
  (`:313-318`), then `UPDATE … WHERE id IN (dueIds)` (`:322-324`) with **no
  `status='CONFIRMED'` guard**. A date rated/completed between the SELECT and the
  UPDATE is wrongly flipped to NO_SHOW.

`CLAUDE.md` states the sweep marks dates NO_SHOW as the *"first writer of that
status"* — the code does **not** enforce first-writer on the NO_SHOW path. This is
on the active branch (`feat/virtual-date-lifecycle-hardening`). Low-stakes
(dating status / no-show metric); single-sweep job narrows the window to a
concurrent user action. Fix is a one-line `and(eq(status,'CONFIRMED'), …)` in the
UPDATE. **Verified first-hand.**

### P2-4 — Audit-chain coverage gaps
**Sev:** P2 · **Area:** G · **Files:** `apps/api/src/matchmaking/requests/service.ts:442-501` (block/unblock), `apps/api/src/video/service.ts:287-326` (virtual-date lifecycle)

`blockUser`/`unblockUser` (a **safety** action) and the virtual-date
lifecycle sweep mutate state without appending to the chained audit log. An
abuse/safety investigation would find no tamper-evident trail of a block. Note
this is a *completeness* gap, not tamper-evidence weakness. **(KYC is not a gap —
it has `kyc_audit_log`.) block/unblock verified first-hand.**

### P2-5 — Pino `set-cookie` not redacted
**Sev:** P2 · **Area:** C · **File:** `apps/api/src/lib/logger.ts:19-34`

The Pino redaction list covers `req.headers.cookie`, `req.headers.authorization`,
`razorpayKeySecret`, `email`, `phone`, `phoneNumber`, `password`, `token`, `otp`,
`aadhaar` — but not `res.headers['set-cookie']`, which carries the session token.
Low-risk (response headers are rarely logged on this stack), but a session cookie
in a log line is a credential. **Reported by fan-out; plausible.**

### P2-6 — Duplicated audit-hash implementation
**Sev:** P2 · **Area:** G · **Files:** `apps/api/src/payments/service.ts:26`, `apps/api/src/admin/platformSettings.router.ts:31`, `apps/api/src/jobs/auditChainVerifierJob.ts:37`

Three byte-identical copies of the chain-hash function exist (two writers + the
verifier). If any copy drifts (algorithm, separator, encoding), the chain
silently fails to verify. Consolidate to one shared helper. **Verified first-hand.**

### P3 / informational (recorded, not defects)
- **`/security/overview` self-view masking asymmetry** (`auth/securityRouter.ts:181,183`) — masks phone, returns email raw, but only ever for `WHERE user.id = userId` (the caller's own account). Not a leak; cosmetic inconsistency at most.
- **Admin/family Server Actions** lack client-side auth checks — defense-in-depth only; the API is the enforced boundary (`authorize(['ADMIN'])` / relationship check).
- **KYC audited via non-chained `kyc_audit_log`** — adequate; add tamper-evidence only if a compliance requirement demands it.
- **Audit chain is scoped per-`entityId`** — wholesale deletion of *all* of one entity's rows verifies clean (inherent limitation of per-entity chaining without an external anchor).

---

## 4. Verified clean (what held up)

Recording what was checked and passed — a security report should state its
negatives, not only its positives.

- **Razorpay webhooks** (payments `index.ts:209`, store `index.ts:223`): HMAC-SHA256
  with `timingSafeEqual` + length guard (`lib/razorpay.ts:144-148`); `express.raw()`
  mounted **before** the global `express.json()` (`index.ts:237`) with a hard-fail if
  the raw body is missing (`payments/webhook.ts:64-77`); idempotency by
  `(provider, eventId)` with duplicate short-circuit (`webhook.ts:115-133`);
  7-day replay-age guard (`:99-107`); multi-secret rotation. *(first-hand)*
- **SSRF — chat link preview** (`chat/linkPreview.ts:56-113`): scheme allowlist +
  hostname blocklist + a genuine **DNS-rebinding guard** that resolves the host and
  requires *every* resolved IP to be public-unicast (`ipaddr.js`), fail-closed,
  2 s timeout, literal-IP fast-path. No other server-side fetch of a user-supplied
  URL exists. *(first-hand)*
- **Booking double-book**: partial unique index `booking_active_unique_idx` on
  `(vendor_id, event_date) WHERE status IN ('PENDING','CONFIRMED')`
  (`migrations/0011_easy_ultimo.sql:2`, schema `index.ts:970`). *(first-hand)*
- **PII masking**: profiles return `null` phone/email for non-self viewers
  (`profiles/service.ts:104,397`); contact unlock is bilateral
  (`safety.service.ts:169-243`); match feed and socket events carry only
  `profileId`; Sentry (`lib/sentry-redactor.ts`) and Pino redaction wired. *(fan-out C + `mask.ts` first-hand)*
- **KYC raw data**: none stored — PAN and phone are SHA-256 hashed
  (`kyc/pan.ts:20`, `kyc/duplicateCheck.ts:29`), Aadhaar kept as ref + `last4`
  only. *(first-hand)*
- **Secrets & storage**: no committed real credentials (only doc placeholders);
  sessions in Redis (no in-memory store); mobile tokens in `SecureStore`; R2 via
  pre-signed URLs, no byte-streaming through the API. *(fan-out F)*
- **Authz on mutations**: 100+ POST/PUT/PATCH/DELETE routes authenticated; role
  gates on admin/support/vendor; `users/router.ts` `VALID_ROLES` enum blocks
  self-assigning ADMIN/SUPPORT; service-layer ownership asserts
  (`assertVendorOwner`, `resolveProfileId`, `authorizeBookingAccess`). *(fan-out B, consistent with A1)*
- **Rentals tenant isolation**: all routes authenticated; vendor-ownership `403`s
  on confirm/activate/return (`rentals/service.ts:348,395,441`); customer-/vendor-
  scoped list queries (`:473,:489`); uses `user.id` TEXT directly (no
  profileId-confusion surface). *(first-hand — closes an A1 coverage gap)*

---

## 5. Coverage limitations (honest boundaries of this pass)

- **ai-service (Python)** and **mobile (Expo)** were **not** audited in this pass.
- Not every API module was exhaustively swept for tenant filters. Confirmed by
  fan-out/verification: profiles, matchmaking, bookings, payments, weddings,
  guests, chat, vendors, video, KYC, storage, notifications, admin (8 routers),
  reports, documents, support, rentals. **Not exhaustively swept:** post-marriage
  (PARTIAL per PASS-0), whatsapp, retention, marketing, destinations. The audited
  set shows a consistent, safe pattern — but a consistent pattern is not proof for
  every route. **Recommend a targeted follow-up** on the un-swept modules.
- **P2-1** is reasoned from documented Postgres `jsonb` semantics, not empirically
  reproduced (local Postgres was down; per project notes WSL/Docker DB access is
  intermittent). Reproduce against a real PG before/as part of any fix.

---

## 6. Cross-references & baseline

- **`PASS-1-FINDINGS.md`** holds **P1-001** (ai-service sklearn/joblib deserialization
  unguarded on unbounded numpy/sklearn pins). Not repeated here.
- **`PASS-0-INVENTORY.md`** is the feature/route/test ground truth.
- **No baseline movement:** this pass wrote only documentation. The frozen test
  baseline — **API 1388 · ai-service 452 · web 24 · mobile 208 · Playwright 7/23**
  — is unchanged, and no code, schema, or migration was touched.
