# Launch Checklist — Smart Shaadi

> **Purpose:** the single pre-launch gate list. Nothing in `GO-LIVE-RUNBOOK.md`
> starts until every **Section A — BLOCKER** here is DONE. This is the "are we
> allowed to launch yet?" document; the runbook is the "how we launch" document.
>
> **Companion docs:** `docs/launch/mock-to-real-swap.md` (per-provider swap +
> verification), `docs/launch/GO-LIVE-RUNBOOK.md` (ordered launch-day steps),
> `docs/launch/FIRST-24H-MONITORING.md` (post-launch watch + escalation),
> `docs/MIGRATIONS-PENDING.md` (drift), `docs/calendar-muhurat-conventions.md`
> (panchang decisions).

---

## GO / NO-GO

**STATUS: 🔴 NO-GO** *(as of 2026-06-16)*

Blocked by **3 external registrations** (Razorpay live, MSG91 DLT, legal review).
The 1 engineering blocker (migration drift) is **DONE** (A4, 2026-06-07). The code
that has shipped since this checklist was first written — pricing engine, GDPR
consent+export, Phase 4.5 hardening — is DONE and listed in **Section D**; none of
it moves the verdict. All **code-fixable** P0/P1 are closed
(`docs/PHASE-1-4-AUDIT.md`: 4 P0 open — all external-blocked; 0 code-fixable P1
open). The codebase is launch-ready; the *platform* is not, because it cannot yet
send a real OTP, verify identity, or process real INR.

GO is reached when **Section A** is all-DONE and **Section B** is verified green at
flip time.

---

## Owners

- **Ashwin** — sole engineering execution owner. Code, env wiring, migrations,
  health checks, smoke tests.
- **Colonel Deepak** — client. External business registrations, legal sign-off,
  panchang/muhurat convention authority. Items needing a vendor account, a lawyer,
  or a tradition call are his.

---

## Section A — BLOCKERS (launch cannot proceed until ALL done)

| # | Item | Owner | Status | How to verify |
|---|------|-------|--------|---------------|
| A1 | **Razorpay live account** approved; `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` in Railway + `NEXT_PUBLIC_RAZORPAY_KEY_ID` in Vercel | Colonel (register) → Ashwin (wire) | 🔴 OPEN | Both webhook endpoints registered; send a Razorpay **test event** to each → HTTP 200 + a `webhook_events` row marked **PROCESSED**; a bad-signature delivery → 400 (`/api/v1/payments/webhook`) / 401 (`/api/v1/store/webhook/razorpay`). Per `mock-to-real-swap.md` step 5. |
| A2 | **MSG91 DLT sender + template** registered/approved; `MSG91_API_KEY` + `MSG91_SENDER_ID`/template ids in Railway | Colonel (register) → Ashwin (wire) | 🔴 OPEN | After master flip, request an OTP to a **real handset** → delivered + login completes. Per swap step 3. DLT approval is regulatory lead-time (weeks). |
| A3 | **Legal pages human/lawyer reviewed** (T&C, Privacy, Refund, etc.) | Colonel / lawyer | 🔴 OPEN | Written sign-off recorded; reviewed pages live on `smartshaadi.co.in`. |
| A4 | **Migration drift reconciled** — `__drizzle_migrations` baseline-seeded + 0029 finished | Ashwin | 🟢 DONE (2026-06-07) | Done via `scripts/db/reconcile-drift-2026-06-07.sql` (psql, additive/idempotent, verified — 30 rows, 0029 columns+index present). Table was absent on prod; baseline-seeded all 30. Rollback: `scripts/db/rollback-drift-2026-06-07.sql`. See `docs/MIGRATIONS-PENDING.md`. |
| A5 | **`AI_SERVICE_HEALTH_URL` set in Railway** | Ashwin | 🟢 DONE — re-confirm | `pwsh scripts/health-check.ps1 -Env prod` probes `ai-service health` (row is **not** SKIPPED). Configured 2026-06-07; confirm still present before launch. |

> A1–A3 are **external** and gate on weeks of regulatory/legal lead time, not hours
> of engineering. A4 is the only purely-engineering blocker.

---

## Section B — VERIFY-BEFORE-LAUNCH (must be green at flip time)

Run these immediately before / during the go-live window. They are not "register an
account" gates — they are "prove it works right now" gates.

| # | Item | Owner | How to verify |
|---|------|-------|---------------|
| B1 | **Full browser smoke on prod** — signup → OTP → profile → match → chat → booking → pay | Ashwin | Manual walkthrough on `smartshaadi.co.in`. No 500s from Server Components, console clean, network tab no errors. (Verification Protocol, CLAUDE.md.) |
| B2 | **Calendar muhurat convention confirmed** — Devshayani Ekadashi (4 held-out July dates) + post-Sankranti January (4 omitted dates) | Colonel | Written decision recorded in `docs/calendar-muhurat-conventions.md`; seeded dataset matches the decision (currently **56** muhurats for 2026). If Colonel restores dates: edit `build-calendar-dataset.mjs`, regenerate, update `test_calendar.py` counts, re-seed. |
| B3 | **Flag-parity test green** | Ashwin | `pnpm --filter @smartshaadi/api test flagParity` passes — `apps/api/src/__tests__/flagParity.test.ts` (8-combo truth table + Mongo/R2/KYC read+write parity). |
| B4 | **All health checks pass incl. ai-service** | Ashwin | `pwsh scripts/health-check.ps1 -Env prod` → exit 0; all 4 targets (api `/health`, api `/ready`, web `/`, ai-service `/health`) probed and 200. |
| B5 | **Real-mode env guards satisfied** — every required cred present | Ashwin | API boots with `USE_MOCK_SERVICES=false` and **no** `env.ts` superRefine exit. Required: `DAILY_CO_API_KEY`, `RAZORPAY_KEY_ID`/`_SECRET`, `RAZORPAY_WEBHOOK_SECRET(S)`, `MSG91_API_KEY`, all four `CLOUDFLARE_R2_*`, `METRICS_TOKEN`. |
| B6 | **CI green** incl. webhook replay + flag parity | Ashwin | `*/webhook.replay.test.ts` and `flagParity.test.ts` green on the launch commit. |
| B7 | **Placeholder supply decision made** — fictional seed inventory is either replaced or knowingly accepted | Colonel + Ashwin | `scripts/placeholder-exposure.sh` against prod. Reports per-table exposure and hard-fails if any placeholder row carries a reachable contact address. `--gate` exits 1 while any placeholder row remains. See below. |

### B7 — what the placeholder gate is actually asking

Sprints 8.1s/8.2 seeded four supply tables with **fictional** inventory
(currently **80 rows**: 24 premium packages, 28 post-marriage services, 16
service partners, 12 vendors) so those features work end-to-end before any
partner signs. `is_placeholder` is internal provenance only — it never hides a
row or changes its ranking, and gates exactly one thing: placeholder supply
cannot be booked or paid for (`assertBookable`, `apps/api/src/packages/service.ts`).
Enquiries stay open, which is the point of seeding it.

So this is **not** a code gate — the code contract is built and tested. It is a
business decision that has to be made consciously rather than by default:

- **Ship as-is** — the public sees plausible venues with in-house SVG art,
  no contact details, and pricing that is market-plausible but not quoted by any
  venue. Enquiries route to an admin. Defensible for a soft launch; it means real
  users send real enquiries about venues we cannot yet deliver.
- **Replace first** — licensed photography, real partner contacts, re-based
  pricing. Onboarding a real partner is `UPDATE ... SET is_placeholder = false`
  from `/admin/packages`; no schema change, no re-keying.

The script's one hard failure is contact reachability: fictional supply must
never carry an address a member of the public could act on. That currently
passes (placeholder rows carry no contact details at all).

**Decision recorded 2026-07-19: ship as-is, guard ON.** For client-demo and
soft-launch purposes the placeholder supply stays exactly as seeded and
`assertBookable` keeps refusing it with `PLACEHOLDER_SUPPLY`. No row is to be
promoted with `is_placeholder = false` until a real partner is actually signed —
promoting one for demo convenience would make a venue nobody has a contract with
genuinely bookable and payable in production. The demo shows browse → enquiry →
admin triage, which is the real flow; the honest framing to the client is
"preview inventory pending partnerships."

This item stays **open**, because the decision is reversible and the content half
(licensed photography, real contacts, quoted pricing) is unchanged. Re-verified
2026-07-19: 80 rows, contact safety OK.

---

## Section C — KYC stays MOCKED at launch (explicit non-goal)

This is intentional, not an oversight. DigiLocker registration is still pending, so
**`KYC_LIVE` stays unset** through the master flip.

| # | Item | Owner | How to verify |
|---|------|-------|---------------|
| C1 | `KYC_LIVE` absent from Railway env at launch | Ashwin | `KYC_LIVE` not set. `shouldUseMockKyc = USE_MOCK_SERVICES \|\| !KYC_LIVE` stays **true**, so DigiLocker stays stubbed even after `USE_MOCK_SERVICES=false`. |
| C2 | KYC flow reaches `MANUAL_REVIEW` (not a throw) | Ashwin | Submit a (mocked) KYC → lands in `MANUAL_REVIEW`; admin `approveKyc` works end-to-end. |
| C3 | Flip `KYC_LIVE=true` later, once DigiLocker lands | Ashwin (post-launch) | Tracked as a post-launch item, not a blocker. Per swap step 4. |

---

## Section D — shipped code (DONE, not gating)

Work merged to `main` since this checklist was first written. It is launch-ready
code and needs no further engineering before go-live. **None of it changes the
verdict** — the platform is still 🔴 NO-GO purely on the three external
registrations in Section A.

| # | Item | Status | Provenance |
|---|------|--------|------------|
| D1 | **Pricing engine** — deterministic dynamic-pricing (Phase 5 Tier 1) | 🟢 DONE | merged `e490a4f` (core `0c1e465`); `apps/ai-service` pricing router + tests green. |
| D2 | **GDPR consent + export** | 🟢 DONE | migration `0023_gdpr_consent_and_export.sql` in repo; part of the 30-migration prod baseline reconciled in A4 (`dr-replay-verification.md`) — schema present on prod, not a fresh prod-run. |
| D3 | **Phase 4.5 hardening** | 🟢 DONE | shipped; all code-fixable P0/P1 closed (`docs/PHASE-1-4-AUDIT.md`). |
| D4 | **Calendar / muhurat dataset** | 🟢 DONE (code) | seeded (56 muhurats 2026); the only open piece is the **convention call** B2, which is Colonel's, not code. |

> Section D is informational. A green Section D with an open Section A is still a
> NO-GO — code-readiness never overrides the external-registration gate.

---

## Quick reference — what each flag does at launch

| Flag | Launch value | Note |
|------|--------------|------|
| `USE_MOCK_SERVICES` | `false` | flipped LAST (runbook step 2) |
| `MONGO_LIVE` | `true` | redundant once master off, harmless |
| `R2_LIVE` | `true` | redundant once master off, harmless |
| `KYC_LIVE` | **unset** | KYC intentionally stays mocked (Section C) |
| `ALLOW_MOCK_SERVICES_IN_PROD` | **unset** | never set in a real launch |
| `MOCK_OTP_VALUE` | **removed** | only needed while mock master on |
| `METRICS_TOKEN` | set | required by real-mode guard |

> **There is no `RAZORPAY_LIVE` / `MSG91_LIVE` flag.** Payments + SMS go live only
> when `USE_MOCK_SERVICES=false`. Only Mongo, R2, and KYC have granular overrides.
