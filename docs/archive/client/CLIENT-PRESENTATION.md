# Smart Shaadi — Client Presentation

> **Audience:** Col. Deepak (client) · **Presenter:** Ashwin Hingve · **Date:** TBD · **Duration:** 60 min (10 min slides + 25 min live demo + 25 min Q&A)
>
> **Source for slides.** Each `## Slide N` block becomes one slide in Keynote / Google Slides / PDF. Speaker notes follow each slide.

---

## Slide 1 — Title

> **Smart Shaadi**
> *National Smart Marriage-Centric Event Ecosystem*
>
> Status update — Phase 1 + Phase 2 + Multi-Event/Polish complete
>
> Ashwin Hingve · 2026-05-02

**Speaker notes.** Set tone: this is a milestone review, not a status meeting. We have shipped a complete platform; today is about validating it together and aligning on activation steps.

---

## Slide 2 — What's been built

> **Phase 1 + 2 + Multi-Event + Polish — all shipped**
>
> 14 feature domains · 466+ automated tests · 9 database migrations · 3 services live on staging
>
> | Domain | Status |
> |--------|--------|
> | Auth (TOTP 2FA + OTP + audit log) | ✅ |
> | Profiles + Community + Safety | ✅ |
> | Matchmaking + Guna Milan | ✅ |
> | Match requests + Chat + Video | ✅ |
> | Vendors + Booking + Rentals | ✅ |
> | Payments + Escrow + Disputes | ✅ |
> | Wedding planning (multi-event) | ✅ |
> | Family + Guests + RSVP | ✅ |
> | KYC pipeline (mock + real-ready) | ✅ |
> | Notifications (email + SMS + push) | ✅ |

**Speaker notes.** Lead with completeness. The system is end-to-end — every flow from signup to payout works. The work delivered exceeds the original Phase 1+2 scope.

---

## Slide 3 — How we present today

> **Three pillars**
>
> 1. **What's built** — live demo, 25 minutes, every flow on staging
> 2. **How it's hardened** — security, audit, observability story
> 3. **What's next** — provider activation roadmap, client action items

**Speaker notes.** Frame the rest of the meeting. Pillar 1 = the demo. Pillar 2 = trust-building. Pillar 3 = the ask: what we need from the client to flip switches.

---

## Slide 4 — Pillar 1: Live demo

> **Live walkthrough on staging**
>
> URL: `https://staging.smartshaadi.co.in`
> Demo logins prepared for: bride profile, groom profile, vendor, admin
>
> 25 minutes covering:
> - Onboarding (OTP signup → profile → KYC)
> - Matchmaking (Guna scores, reciprocal filter, Safety Mode)
> - Communication (chat, translation, video call)
> - Wedding planning (ceremonies, muhurat, guests, seating, moodboard)
> - Vendor + booking + payment + dispute resolution
> - Admin + observability dashboards

**Speaker notes.** Pause here. Switch to live demo following `docs/DEMO-SCRIPT.md`. Recovery plan ready if any flow stutters.

---

## Slide 5 — Pillar 2: How it's hardened

> **Security by construction**
>
> - **PII never leaks.** Phone + email withheld until both parties consent. All logs auto-redact via Pino.
> - **Payments are bulletproof.** HMAC-SHA256 webhook + replay-protection. Optimistic CAS on escrow — no double payouts.
> - **Multi-tenant safe.** Every database query filters by user. Architectural rule, not a habit.
> - **Audit log chained-hash.** Every dispute + escrow transition is tamper-evident.
> - **DPDP-ready.** Soft-delete + 30-day purge. Data export endpoint. KYC verification only — never raw Aadhaar.

**Speaker notes.** Each bullet has specific code evidence in `docs/SECURITY-REVIEW.md`. Offer the document for legal counsel review.

---

## Slide 6 — Pillar 2: Observability

> **Three dashboards open right now**
>
> | Tool | Watching |
> |------|----------|
> | Sentry | All errors, all 3 services |
> | PostHog | Live user events |
> | Grafana | RPS, queue depth, webhook delivery |
>
> Plus: pino structured logs, /health + /ready on every service, BetterStack uptime monitoring.

**Speaker notes.** Show live dashboards during demo (slide 4 segment 6). Point out Sentry is empty — that's good. PostHog shows the events from the demo flow.

---

## Slide 7 — Pillar 3: Provider activation roadmap

> **What's mocked vs live today**
>
> | Live | Mocked (ready to flip) |
> |------|------------------------|
> | Razorpay (test mode) | Razorpay LIVE |
> | All UI/UX | MSG91 (SMS, OTP) |
> | All business logic | DigiLocker (Aadhaar) |
> | All database flows | NSDL (PAN) |
> | All audit/security | AWS SES (email) |
> | | AWS Rekognition (KYC face) |
> | | Refinitiv (sanctions) |
> | | Daily.co (video) |
> | | Karza (criminal records) |
> | | FCM (push) |
>
> **Each provider has a runbook.** See `docs/PROVIDER-ACTIVATION/`.

**Speaker notes.** This is the honest framing — system is complete; providers are gated on agreements. The mock layer is symmetric: flipping a flag activates real flow with zero code change.

---

## Slide 8 — Pillar 3: Activation timeline

> **What goes live when, after you sign**
>
> | Provider | Time-to-live | Client effort |
> |----------|--------------|---------------|
> | Daily.co paid | **1 day** | Plan upgrade |
> | Firebase FCM | **1 day** | Service account JSON |
> | AWS Rekognition | **1 day** | IAM keys |
> | Razorpay LIVE | **3–5 days** | Merchant KYC |
> | AWS SES | **1–2 weeks** | DKIM + sandbox lift |
> | Karza criminal | **1–2 weeks** | Vendor contract |
> | MSG91 + DLT | **2 weeks** | DLT registration |
> | NSDL PAN | **2–3 weeks** | NSDL onboarding |
> | DigiLocker | **4 weeks** | MoU signing |
> | Refinitiv | **4–6 weeks** | Licence (optional v1) |
>
> **Recommended sequence:** Razorpay first (real revenue), then DigiLocker (start MoU clock), then everything else in parallel.

**Speaker notes.** This is the central slide of the meeting. Walk through: "if you sign Razorpay merchant agreement Monday, real payments flow by Friday. If you start DigiLocker MoU at the same time, KYC tier 2 lands a month later."

---

## Slide 9 — Pillar 3: Client action items

> **What we need from you to start**
>
> Immediate (this week):
> - [ ] Razorpay merchant signup + KYC upload
> - [ ] Daily.co plan upgrade
> - [ ] Firebase project + service account
>
> Short-term (this month):
> - [ ] AWS account + SES sandbox lift
> - [ ] DigiLocker partner application
> - [ ] MSG91 + DLT registration on 4 telco portals
> - [ ] NSDL onboarding
>
> Medium-term (next 6 weeks):
> - [ ] Refinitiv quote + contract (if NRI expansion is in scope)
> - [ ] Karza or AuthBridge vendor contract for criminal check
>
> **Each runbook in `docs/PROVIDER-ACTIVATION/` lists exact documents and steps.**

**Speaker notes.** This is the ask. Be precise. Hand over the printed `PROVIDER-ACTIVATION` README. Offer to set up calls with Razorpay sales together.

---

## Slide 10 — What's next

> **Phase 3 — AI Intelligence Layer (preview)**
>
> Coming after platform launch is stable for 7 days:
>
> - LLM-driven matchmaking explainer ("why this match")
> - Smart replies in chat (Hindi-English bilingual)
> - Wedding-task auto-suggestions ("you should book caterer 60 days before")
> - PostHog session replay for product insights
> - OpenTelemetry tracing for performance
>
> **Phase 7 — Mobile**
>
> React Native (iOS + Android) — separate workstream, post-launch.

**Speaker notes.** Set forward expectations. Phase 3 is gated on at least one provider live (so we have real signal to learn from). Phase 7 mobile is its own scope; defer until web platform proves market fit.

---

## Slide 11 (optional, contingency) — If asked: "Why isn't this live yet?"

> **Talk track**
>
> "The platform is built and tested. Going live needs **agreements you sign with each provider**:
> - Razorpay merchant KYC (3–5 days)
> - DigiLocker MoU (4 weeks)
> - MSG91 DLT registration (2 weeks)
> - NSDL onboarding (2–3 weeks)
>
> I've put together a per-provider checklist showing exactly what each needs from your side and how long after signing each goes live. The system is ready to flip on the moment each agreement lands. We can start whichever you want today — Razorpay is the fastest."

**Speaker notes.** Don't preempt this slide. Use only if the question comes up. Convert delay-perception into client-action item with concrete next step.

---

## Slide 12 — Close

> **Today**
>
> - System: end-to-end functional, demo-ready ✅
> - Security: hardened, auditable ✅
> - Observability: live ✅
> - Provider activation kit: ready ✅
>
> **This week**
>
> Pick one provider to start. **Recommend Razorpay LIVE.**
>
> - Real payments flow by next Friday
> - Real revenue starts the same day

**Speaker notes.** End with a concrete week-1 outcome. Hand over the `PROVIDER-ACTIVATION` folder + the `SECURITY-REVIEW` PDF. Schedule next sync for one week out.

---

## Pre-meeting checklist (developer)

Day-of:
- [ ] Staging URL up and warm (run a smoke 30 min before meeting)
- [ ] Demo accounts logged in on second browser tab (saves login time)
- [ ] Sentry / PostHog / Grafana dashboards open in tabs
- [ ] Demo recording (backup) available offline in case staging is down
- [ ] `docs/PROVIDER-ACTIVATION/` printed (12 sheets) for handover
- [ ] `docs/SECURITY-REVIEW.md` printed for legal counsel
- [ ] Architecture diagram printed
- [ ] Test report (latest CI run) printed

Materials to leave with client:
- Provider Activation Kit (README + 11 runbooks)
- Security review summary
- Architecture diagram
- Test report
- This presentation deck

---

## Q&A — Likely questions and answers

**Q: How confident are you the system will work under real load?**
A: We've run 100 RPS sustained for 5 minutes against the staging API; p95 was under 500ms. We have observability in place to catch issues before users notice. (Show Grafana load test results.)

**Q: What if Razorpay's risk team flags us during onboarding?**
A: Common; usually resolved in 24h. They typically ask for proof of business model (we have GST, GSTIN, agreements with vendors). I'll be on standby to respond.

**Q: How do we handle a security breach?**
A: Sentry pages immediately. We have a runbook in `docs/RUNBOOK.md` covering the top 5 incident scenarios with response steps. PII is redacted in logs. Audit log is chained-hash so tampering is provable.

**Q: What's the monthly running cost?**
A: ~₹50k for hosting + ~₹1L for external providers at 10k MAU. See `docs/PROVIDER-ACTIVATION/README.md` for the full cost breakdown.

**Q: How long until we can start charging customers?**
A: Razorpay LIVE in 5 days after you sign the merchant agreement. The platform earns its first commission the same day.

**Q: What's the next phase?**
A: AI Intelligence Layer — match explanations, smart chat replies, planning suggestions. Estimated 4 weeks after launch is stable.

**Q: When does the mobile app come?**
A: Phase 7. Web platform proves market fit first; mobile is a separate workstream targeting Q3 2026.

**Q: Who else has seen this?**
A: Just you, me, and the codebase. No external review yet — I can engage a third-party security audit if you want, recommend that before any large-scale launch.

---

## Format

- **Slides:** convert this Markdown to Keynote/Google Slides. One slide per `## Slide N` block.
- **Demo:** follow `docs/DEMO-SCRIPT.md`.
- **Handout:** print `docs/PROVIDER-ACTIVATION/README.md` (8 pages) + each provider runbook (1–2 pages each, total ~25 pages). Bind in folder.
