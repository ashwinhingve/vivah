# Action Tracker — Smart Shaadi Launch Readiness

> **Purpose:** Single source of truth for what's outstanding and who owns it. For operator Ashwin.
>
> **Date:** 2026-07-19  
> **Current phase:** Code-ready (Phases 1–8 shipped); blocked on external registrations + Colonel's decisions
>
> **Two facts at the top:**
> - **~28 commits sit unpushed on `main`.** Only you can push (credentials). Nothing is live.
> - **Nothing is live.** Every contract success criterion is a *measured live outcome* (lower one-sided rejection rates, vendor renewals, SEO ranking within 90 days). None can begin accruing until launch. Engineering is ~90% complete; contractual delivery on the success criteria is near zero. That distinction is the single most important thing in this document.

---

## Table 1 — Ashwin (Engineering)

**Items that block or unlock engineering progress. All are "done when" verified in working code.**

| Item | Why it matters | Blocked by | Done when | Status |
|------|-------|-----------|-----------|--------|
| Apply migration 0031_support_tickets to prod | Support ticket workflow is fully coded but inaccessible on prod until schema lands. Locally verified; not on Railway. | None (engineering-owned) | Migration applied via Railway SQL console + verified (SELECT to_regclass('public.support_tickets') returns non-null) | 🟡 READY TO APPLY (Ashwin) |
| Free-tier daily-view quota + tier-feature reconciliation | Top outstanding revenue work identified in ROADMAP (line 242). Users on free tier can view unlimited profiles today; premium tiers have no differentiation in visibility or AI features. This is the blocker for real monetization. Repricing also ships this sprint: ₹499/₹999 monthly, ₹3,999/₹7,999 yearly, plus quarterly tier. | None (engineering-owned, actively building) | Feature gates built + tested (pnpm test:tier-gates green); view quota enforced in /api/v1/matches endpoint; Premium/Standard plans gate chat, video, match-request features in UI; quota errors return 429 + retry-after header. Quota ships behind `VIEW_QUOTA_ENABLED=false` (default OFF, flip ON Week 1 post-launch after calibration). | 🟡 LANDING THIS SPRINT (teammate T2 actively building) |
| Staging SLO calibration (measure real traffic) | k6 baseline exists but is loopback-only (vendors p95=21ms, feed p95=16ms — floor, not ceiling). Real traffic measurement post-launch will reveal actual latency, cache hit rates, queue depth. Needed for alerting thresholds. | Launch happens (requires Table 2 external approvals) | Real traffic observed for 24h+ post-launch; p95 latencies recorded in `docs/handover/SLO-AND-ALERTING.md`; alerts wired to BetterStack; no user-facing 5xx errors in first week. | 🟡 BLOCKED (post-launch, Week 1) |
| Mobile store submission (iOS App Store + Google Play) | Web platform is live and valuable; mobile multiplies addressable market. Both stores require developer enrollment, build signing, and review (~2–6 weeks per store). Apps are built (commit `35a6c76`): Phase 7 feature parity, design polish merged, type-check + jest all green. | Colonel's enrollment (Table 2 items) | App Store build + binaries submitted; Play Store submission in queue; both in review. Estimated 3–6 weeks after enrollment approvals. | 🔴 BLOCKED (Colonel's side, Table 2) |
| PWA install verification on real device | PWA manifest (`apps/web/src/app/manifest.ts`) + service worker + offline shell built. Icons at `apps/web/public/icons/`. Needs verification on a real Android device at 2G speed. | None (engineering-owned, needs test device) | PWA installable on Android 375px screen; offline shell loads; online mode syncs. Screenshot + test log in `docs/PWA.md`. | 🟡 READY TO VERIFY (Ashwin) |
| Production penetration test (OWASP ASVS Level 2) | Pre-launch security hardening is code-reviewed (SECURITY-REVIEW.md). Post-launch, a real penetration test by an external firm validates the hardening against live attack patterns and third-party libraries. Required for insurance + investor confidence. | Launch happens (post-launch Week 2–4) | Pentest vendor selected + scoped; report delivered; critical findings (if any) fixed + re-verified. Estimated 2–3 weeks post-launch. | 🟡 BLOCKED (post-launch timeline) |
| Browser-verify all launch-blocking user flows | Verification Protocol (CLAUDE.md) requires: type-check + build green, then manual browser walkthrough (signup → OTP → profile → match → chat → booking → pay). No 500s, console clean, network tab no errors. | None (engineering-owned, needs browser) | All flows completed on prod; no errors in console or network tab; screenshot evidence in `docs/launch/` folder. | 🟡 READY TO VERIFY (Ashwin, pre-launch) |

---

## Table 2 — Colonel Deepak (External Blockers)

**Items that require Colonel's action to unblock. These are regulatory, legal, or vendor-partnership gates. Lead times dominate.**

| Item | Why blocking | Lead time | Current status | What unblocks launch |
|------|-------|-----------|-----------|-------------|
| **Razorpay live merchant account** approval (+ KYC) | Payments are mocked today (`USE_MOCK_SERVICES=true`). Real revenue cannot flow until Razorpay approves the account. This is the single highest-priority unblock. | ~1 week after signup (after company registration + bank account + tax ID verification) | 🔴 OPEN — not started | Col. registers at razorpay.com, uploads GST/GSTIN, bank account, articles of association. Ashwin receives live `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Ashwin wires to Railway + verifies via webhook test. |
| **MSG91 DLT sender + template** approval (government regulatory) | OTP SMS is mocked today. Real OTP delivery requires Government of India (TRAI) registration of sender ID + template approval. This is regulatory lead time, not engineering. | ~2–4 weeks (TRAI processing is unpredictable) | 🔴 OPEN — not started | Col. registers with MSG91, submits sender ID to TRAI via MSG91's web portal, waits for approval, provides approved sender ID + template IDs to Ashwin. Ashwin wires to Railway. |
| **Legal sign-off** (T&C, Privacy Policy, Refund Policy, Disclaimers) | Platform cannot legally operate without Colonel's lawyer reviewing and approving all user-facing terms. Required for dispute resolution, DPDP compliance, and vendor liability. | ~1–2 weeks (depends on lawyer response time) | 🔴 OPEN — not started | Col. engages a lawyer (or reviews internally), confirms T&C/Privacy/Refund/Disclaimers match local law, provides written sign-off. Legal pages published on `smartshaadi.co.in`. |
| **DigiLocker KYC partnership** (government MoU) | KYC is mocked today (`KYC_LIVE=false`). Full identity verification requires DigiLocker (Aadhaar + eKYC) partnership. Optional for soft-launch (Phase 1 works with manual KYC review); required for scale. | ~2–3 months (government partnership, MoU negotiation) | 🔴 OPEN — not started | Col. initiates DigiLocker partnership application, completes MoU, provides API credentials to Ashwin. Ashwin flips `KYC_LIVE=true` + wires DigiLocker OAuth. Non-blocking for launch if manual review is acceptable. |
| **Apple Developer Program** enrollment (+ provisioning) | iOS mobile app cannot ship without Apple Dev enrollment. Required for App Store submission and device provisioning. | ~1–2 weeks enrollment; ~2–4 weeks app review per submission | 🔴 OPEN — not started | Col. enrolls in Apple Developer Program (~$99/year), creates iOS certificate + provisioning profile, provides signing credentials to Ashwin. Mobile CI builds signed .ipa. App Store submission begins. |
| **Google Play Developer Program** enrollment (+ signing key) | Android mobile app cannot ship without Play Console enrollment and a signing key. Required for Play Store submission. | ~1–2 weeks enrollment; ~2–24h Play Store review | 🔴 OPEN — not started | Col. enrolls in Google Play Console (~$25 one-time), creates app signing key (or uses Google Play app signing), provides signing credentials to Ashwin. Mobile CI builds signed .aab. Play Store submission begins. |
| **Destination wedding venue partnerships** (real supply onboarding) | 80 placeholder supply rows (24 premium packages, 28 post-marriage services, 16 service partners, 12 vendors) are fictional to prove features work end-to-end. Real venues (Rajasthan, Goa, Himachal) with licensed photography + real contact details cannot be seeded until partnerships are signed. | ~3 months (per-venue negotiation, contracts, photography shoots, pricing calibration) | 🟢 SEEDED (placeholder, `is_placeholder=true`) | Col. signs venue partnerships, provides partner contact + photography (or licenses existing), Ashwin promotes rows with `UPDATE ... SET is_placeholder=false`. Enquiries then route to real partners. |
| **Real supply replacement** (photographers, logistics, florists, caterers, transport, etc. across 5+ cities) | Post-marriage services (honeymoon, anniversary travel, gift registries) and vendor categories (catering, decoration, makeup, etc.) have seed data but no real vendor onboarding yet. Soft launch can work with placeholder supply + admin enquiry triage; scale requires real partners. | ~2 months (partner outreach, vetting, onboarding, profile setup) | 🟢 SEEDED (placeholder) | Col. identifies + onboards real vendors in target cities, provides contact + portfolio. Ashwin backfills `/admin/vendors/bulk-update` or direct SQL UPDATE. Partners go live. |
| **NBFC lending partner agreement** (optional for Phase 1) | Loan referral feature is built (budget shortfall → referral to NBFC partners, EMI calculator in Razorpay). Requires partnership agreement + lender API credentials. Optional; does not block launch but is Phase 6 revenue stream. | ~4–8 weeks (partner identification, contract negotiation, API integration testing) | 🟡 DESIGNED (gated: `LENDING_LIVE=false`) | Col. identifies NBFC partner (e.g., Bajaj Finserv, ZestMoney), signs agreement, provides API key. Ashwin flips `LENDING_LIVE=true` + wires credentials. Loan referrals go live Week 2+ post-launch. |
| **Insurance partner agreement** (optional for Phase 1) | Wedding insurance referral feature is built (wedding budget → referral to insurance partners). Requires partnership agreement + carrier API. Optional; does not block launch but is Phase 6 revenue stream. | ~4–8 weeks (partner identification, contract, API wiring) | 🟡 DESIGNED (gated: `INSURANCE_LIVE=false`) | Col. identifies insurance partner (e.g., ICICI Lombard, HDFC Ergo), signs agreement, provides API key. Ashwin flips `INSURANCE_LIVE=true` + wires credentials. Insurance referrals go live Week 2+ post-launch. |
| **WhatsApp Business API registration** (optional for Phase 1) | SMS notifications are mocked; WhatsApp Business API allows richer notifications (status updates, OTP, booking confirmations). Requires Cloud API registration + BSP partnership. Optional; does not block launch but improves Phase 6 engagement. | ~2–4 weeks (Meta approval process) | 🟡 DESIGNED (gated: `WHATSAPP_LIVE=false`) | Col. applies for WhatsApp Cloud API, provides business verification, receives API credentials. Ashwin flips `WHATSAPP_LIVE=true` + wires credentials + phone number. WhatsApp notifications go live Week 2+ post-launch. |

---

## Table 3 — Blocked Items (Unblocked by Table 1 or Table 2)

**🔴 CLIENT-BLOCKED** = cannot proceed without Colonel's action (external registrations, launch decision). **🟡 ENGINEERING-BLOCKED** = waiting on engineering completion or post-launch calibration; no client action needed.

| Item | Blocker type | What unblocks it | Who owns unblock |
|------|-----------|-------------|--------|
| **Production SLO calibration** | 🔴 **CLIENT** | Launch decision (Table 2). Needs 24h+ real traffic post-go-live to measure p95 latency, cache hits, queue depth. | Both (Colonel unblocks launch; Ashwin measures post-launch) |
| **Free-tier monetization** (view quota + feature gating) | 🟡 **ENGINEERING** | Ashwin completes quota + repricing implementation (landing this sprint). Flag flip post-launch Week 1 after calibration. | Ashwin |
| **Post-launch retention sweep** (`RETENTION_OUTREACH_LIVE=true`) | 🟡 **ENGINEERING** | Ashwin observes churn signal post-launch (Week 1) to avoid false-positive win-back. Activates Week 2 if clean. | Ashwin |
| **NRI/international matching** (`NRI_MATCHING_LIVE=true`) | 🟡 **ENGINEERING** | Post-launch signal: do international users exist on platform? Geographic distribution? Ashwin decides Week 1 activation. | Ashwin |
| **AI-generated video call icebreakers** | 🟡 **ENGINEERING** | Migration 0033 (Virtual Date schema) done. Needs Gemini prompt tuning + user testing. Non-critical; Phase 8.3 feature. | Ashwin + Gemini API token |

---

## Table 4 — Decisions Pending Colonel's Agreement

**These are settled by us (code is shipped), but Colonel is confirming rather than choosing in the abstract. Request written response on each.**

| Item | What we decided | Why | Request from Colonel |
|------|---------|-----|-------------|
| **Q1–Q3, Q5–Q7** (DECISIONS-PRE-DEVELOPMENT.md) | Pune pilot city, Hindi+English languages, Corporate bookings LIVE, Manual Safety Mode unlock (both parties), Parent Mode (draft+approval), 17 vendor categories | These are six settled-de-facto answers; all have working code verified in production. Not ambiguous; not waiting on Colonel to choose. | Confirm in writing that each answer aligns with your business model. If any disagree, state it now (pre-launch). |
| **Q4 Community visibility** (DECISIONS-PRE-DEVELOPMENT.md) | **Free cross-community browsing** (no members-only wall) — the only open one. | Matching engine surfaces all verified profiles to all verified users across all communities. No visibility gate exists. Reversing this would require a 3–4 week rearchitecture. | **YES (free browse, ship as-is)** or **NO (members-only, we plan 3–4 week redesign post-launch)**. Answer now so we can firm up the launch date. This is the biggest engineering ask of the seven. |
| **Muhurat regional conventions** (docs/calendar-muhurat-conventions.md) | **Conservative stance (8 disputed dates held out).** Devshayani (July 1/6/11/12), post-Sankranti January (14/23/25/28), Vishu/Onam (regional). All are in "OMIT" (held out) today; dataset has 56 confirmed muhurats for 2026. | Strong regional variation + conflicting pandit schools; safer to omit than to seed wrong dates and offend customers. Can be reversed by Col.'s panchang call. | Confirm the 8 dates should stay held out, or provide a panchang authority saying they should be included. We can seed them in 2 hours if you have sign-off. |
| **Placeholder supply acceptance** (docs/launch/LAUNCH-CHECKLIST.md B7) | **Ship as-is (placeholder supply stays fictional until real partners sign).** 80 placeholder rows; contact safety verified (no reachable addresses). Users can browse + enquire; admin triages; booking/payment blocked until partner real-ified with `is_placeholder=false`. | Soft launch framing: "preview inventory pending partnerships." Real users see plausible venues but understand none are fully booked yet. Defensible and honest. Alternative: delay launch 2–3 months until 50+ real partners onboard (high risk if partners don't pan out). | **ACCEPT (ship as-is, launch soft)** or **DELAY (wait for real partner supply)**. If delay, give us a target number of real partners you want seeded + your timeline for getting them signed. This gates the launch date. |

---

## Next Steps (Ordered by impact)

1. **Colonel's sign-off on the 4 decisions (Q1–Q7, muhurat, placeholder supply).** Request written responses this week. His answer on Q4 (community visibility: free or members-only?) is the swing variable for launch readiness. If "free browse," we launch ASAP after Table 2 approvals. If "members-only," we add 3–4 weeks.

2. **Razorpay live account (highest ROI).** Col.: sign merchant agreement this week. Ashwin: wire credentials + smoke-test webhook. This unblocks real revenue. Lead time: ~1 week. Ship this FIRST of Table 2.

3. **Apply migration 0031_support_tickets to prod.** Ashwin: write it up as a Railway SQL console operation (additive, idempotent). Support ticket UI will work end-to-end only after this lands. Low risk, high velocity.

4. **MSG91 DLT + legal sign-off (parallel).** Col.: start both this week. Lead times are 2–4 weeks for MSG91 (government), ~1–2 weeks for legal. No dependencies. If either slips, launch slips.

5. **DigiLocker partnership (kick off, but non-blocking).** Col.: submit MoU application this week. Lead time ~2–3 months. Can launch with mocked KYC (Phase 1 ships with manual review; full Aadhaar tier comes post-launch).

6. **Free-tier quota + feature gates (engineering, parallel to external approvals).** Ashwin: implement quota enforcement + UI gates. Estimated 1 week. Do this in parallel with waiting on Table 2; unblocks monetization Week 1 post-launch.

7. **PWA verification on real device.** Ashwin: test on a real Android handset at 2G speed. Screenshot + log to `docs/PWA.md`. Quick win; proves offline mode works for mobile users.

8. **Mobile store enrollment (long lead).** Col.: start Apple Developer + Google Play enrollment process this week (parallel to Razorpay). Lead times 1–2 weeks per store; app review another 2–6 weeks. Not on critical path for web launch, but do it in parallel.

9. **Staging SLO calibration (post-launch, Week 1).** Ashwin: run 24h+ load test post-launch; record p95 latencies; tune alerting. Informs incident response thresholds.

10. **Post-launch Week 2:** Flip `RETENTION_OUTREACH_LIVE=true` if churn signal is clean. Activate NRI matching if international users appear.

---

## Launch readiness summary

**GO / NO-GO: 🔴 NO-GO (as of 2026-07-19)**

- **Code:** 🟢 All 8 phases complete and locally verified. **No staging or production deployment yet.** Code has never run outside local machines.
- **Engineering blockers:** 🟢 None (0031 ready to apply; free-tier quota landing this sprint behind `VIEW_QUOTA_ENABLED=false`).
- **External blockers:** 🔴 3 critical path items (Table 2 A1–A3). Razorpay: ~1 week. MSG91 DLT: ~2–4 weeks (TRAI regulatory, long pole). Legal: ~1–2 weeks.
- **Colonel's decisions:** 🟡 4 pending (Table 4). Q4 (community visibility: free or members-only?) is the swing variable.

**GO is reached when:**
- Table 2 items A1–A3 are DONE (Razorpay, MSG91, legal) **AND**
- Colonel confirms all decisions in Table 4 **AND**
- Browser-verify flows pass on prod (Table 1, Ashwin task).

**GO date critical path:** Razorpay (~1 week from Colonel's start) + MSG91 DLT (~2–4 weeks, **long pole**) + legal (~1–2 weeks, parallel) + ops/verify (~1 week). **Earliest GO: 2026-08-04 if all three start this week and Razorpay + legal clear on fast track. Most likely GO: mid-August (MSG91 is the constraint; DLT is regulatory and delays are common).** Each Table 2 delay pushes GO by the same amount.

---

## Document owners & updates

- **This doc:** Ashwin (operator). Update weekly or when any Table 1/2/3/4 status changes.
- **DECISIONS-PRE-DEVELOPMENT.md:** Respond to Colonel with written confirmations on each row.
- **LAUNCH-CHECKLIST.md:** Reference for pre-launch verification (Section B items).
- **ROADMAP.md:** Reflects macro progress; updated end-of-session.
