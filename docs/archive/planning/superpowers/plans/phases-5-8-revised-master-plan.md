# Smart Shaadi · Phases 5–8 — Revised Master Plan

> Drop into `docs/superpowers/plans/phases-5-8-master.md`
> **This supersedes the earlier four-artifact plan.** It is corrected against the real codebase + the May 21 handoff, kept roadmap-level on purpose: these phases are **launch-gated and unfunded**, so per-feature implementation prompts are written when each phase is greenlit — not now, where they'd go stale.

---

## 0. What changed vs the earlier plan (and why)

- **Everything is gated on public launch + real users + Colonel's registrations.** The product is live on-domain but not launched. None of 5–8 compounds before launch; Phase 4.5 → launch comes first.
- **Cost discipline is a constraint, not an afterthought.** Stack is < $15/mo. Infra scales only when a **metric** forces it (see the cost ladder in §6) — not on a phase schedule. The earlier plan's M10 / read-replica / second-region / pgBouncer recommendations are withdrawn until justified.
- **Agents are split correctly.** Deterministic logic (pricing math, calendar/muhurat, currency, monsoon rules, gap detection) is **plain services**, not "agents." Real LLM agents are built on the existing **Mastra + Vercel AI SDK v6** stack that already powers the 11 shipped AI features — not a new bespoke framework.
- **Sub-agent roles, not people.** Build work uses functional Claude Code sub-agent roles (Contracts, Backend, AI/Eval, Frontend, Integration/QA), single-agent-sequential by default, worktrees only for zero-overlap work.
- **Timelines are honest.** Each phase is no longer "one month." Estimates below are solo-dev real and call out external lead times (partners, registrations, store review) that you don't control.
- **A real scaling bottleneck the earlier plan missed:** matching does 50–1,000 serial Mongo round-trips per feed and stores a 1536-dim embedding with **no vector index**. The first genuine scale investment is **pgvector on the existing Postgres** (cheap, no new service), addressed in Phase 5.

**Priority order (confirmed): 5 → 6 → 7 → 8.**

---

## Phase 5 · Vendor Utilization Engine · Calendar AI · B2B

**Goal:** Turn the platform from a seasonal marketplace into a year-round vendor operating system. Route idle vendor capacity to off-season events; fuse Muhurat + festival + school + govt calendars into pricing; open B2B self-serve.

**Launch gate / prereqs:** public launch done; ≥ some real vendors active; Razorpay + DigiLocker registrations live (else stay mocked and ship code only).

**Headline features**
- **Vendor Utilization Engine (P0):** rank off-season event leads per vendor by expected margin; reciprocal vendor↔event filter.
- **Calendar Intelligence (P0):** seed 2026/27 muhurats (deterministic, cross-checked vs Drik Panchang; Jan 2026 has zero, Chaturmas blocks ~Jul–Oct) + festival/school/govt overlays.
- **Dynamic Pricing v1 (P0):** vendor-set base + bounds; suggestion = base × muhurat × off-season × demand, clamped, always overridable, explained in en/hi.
- **B2B self-serve (P1):** GSTIN signup (mocked GSTN), quote → proforma → GST invoice (HSN/SAC).
- **Documentation & e-sign (P0):** contract templates, DigiLocker eSign (+ Signzy fallback), R2-stored signed PDF with hash in the audit chain.
- **Matching scale fix (P0, architectural):** add `pgvector` to Postgres, index the embedding, replace the per-candidate Mongo N+1 with a batched read. This is the first real scale spend and it's nearly free.

**Real AI agents (Mastra):** ContractDrafter (Haiku — picks clauses from an approved library only; never writes legal text), B2BConcierge (Sonnet — explains catalogue, builds quote requests; escalates on "dispute/refund/legal").
**Plain services (NOT agents):** VendorRecommender ranking, CalendarOracle, PricingAdvisor, GapSentinel.

**Complexity / timeline:** **L · ~4–6 weeks solo** (pricing + calendar + VUE are the bulk; eSign gated on registration).
**Top risks:** internal muhurat math drifts from Drik Panchang (shadow + manual diff); dynamic pricing read as surge (vendor bounds + override + transparent explanation); eSign approval delay (Signzy fallback wired first).
**Monetization unlocked:** off-season utilization commission; B2B/institutional commission.

---

## Phase 6 · Auto-Marketing · Multi-city · (Finance, deferred)

**Goal:** Compounding growth — programmatic SEO + WhatsApp + multi-city onboarding. **Lending is deliberately deferred to the back of this phase / behind a gate**, because as a solo dev on an unfunded 3% side-project, regulated lending is disproportionate risk and requires a signed partner you can't unilaterally produce.

**Launch gate / prereqs:** Phase 5 shipped; WhatsApp Business API approved via a BSP (AiSensy/Interakt); real GMV before any lending work.

**Headline features**
- **Auto-marketing engine (P0):** n8n (self-hosted on the existing Railway, behind Cloudflare Access) + a Mastra `MarketingScribe` (Sonnet) generating community×city SEO pages with a **mandatory human approval gate** before publish. Extends the 22 programmatic SEO routes already shipped in Phase 4.
- **WhatsApp Business API (P0):** utility templates (booking/payment reminders, ~₹0.115) + marketing broadcasts (~₹0.86, daily budget cap); Bull dispatcher with dedup job IDs; signed inbound webhook; conversation log with 30-day TTL.
- **Multi-city (P0):** add `cityCode` to vendor/booking/wedding tables (btree index, **no sharding**); per-city concierge onboarding playbook; hyperlocal SEO seeded by the marketing engine; en/hi already live.
- **Vendor "Marketing Plus" tier (P2):** Razorpay subscription, auto Instagram cards + WhatsApp drip.
- **NBFC loan referral (P1, GATED):** only as an LSP/DSA, only after a partner is signed and the entity is mature. RBI digital-lending compliance is mandatory: KFS shown, direct-to-borrower disbursement, FLDG ≤ 5% if applicable, cooling-off honored. **Build against mocks; do not launch lending without the signed partner + a compliance review.**
- **Wedding insurance referral (P1):** deep-linked partner products (cancellation/cover); referral code reconciliation.

**Real AI agents (Mastra):** MarketingScribe (Sonnet), InsuranceConcierge (explains, never advises), LoanMatcher (ranks partners, never promises approval — only if/when lending is greenlit).
**Plain services:** WhatsAppDispatcher (Bull worker), CityLaunchAssistant (admin prospect lists).

**Complexity / timeline:** **XL · ~8–12 weeks** for marketing + WhatsApp + multi-city; **lending adds months** of partner + legal lead time you don't control. Treat marketing + multi-city as the real Phase 6; lending as a separate, gated track.
**Top risks:** RBI rule changes (quarterly compliance review SOP); thin auto-SEO penalties (≥1,800-word pages + human gate); WhatsApp cost overrun (daily cap); CIBIL/PAN leakage in logs (redaction middleware); Tier-2 vendor churn (30-day concierge cadence).
**Monetization unlocked:** marketing SaaS (₹999/mo); multi-city paid placements; (later) loan + insurance referral commissions.

---

## Phase 7 · Mobile App · NRI · Virtual Dates

**Goal:** Reach the highest-LTV segments (NRI) and replace endless DMs with timed, structured video dates. **Mobile auth is a real design item, not a copy-paste** — web uses httpOnly **session cookies (not JWT bearer)**, which don't port to React Native cleanly.

**Launch gate / prereqs:** Phases 5–6 shipped; Apple Developer ($99) + Play Console ($25) accounts; Daily.co account (else mock); Razorpay International / FEMA path confirmed with a CA before charging non-resident cards.

**Sequencing correction — PWA first.** The fastest honest mobile story is hardening the existing Next.js app as an installable PWA (push where supported, offline-tolerant lists) for near-term reach, and treating the **Expo app as a separate, longer track** rather than promising full native parity in weeks.

**Headline features**
- **Mobile auth bridge (P0):** token strategy that works for RN (`expo-secure-store`, never AsyncStorage); reconcile with the existing session-cookie web auth. Design before building screens.
- **Expo app, parity-first (P0):** auth, profile, matches, chat (`socket.io-client`, background-aware), wedding planning, vendor booking. NativeWind mirroring the design tokens. Pin React/RN versions to avoid duplicate-copy issues.
- **NRI matching (P0):** country filter + timezone-aware feed (don't show "online" when they're asleep) + currency-display preference; reciprocal filter still enforced.
- **Multi-currency via a `Money` value type (P0):** BigInt paise + currency, introduced cleanly (ideally seeded in Phase 4.5/5), not retrofitted. Display-only; settlement stays INR for residents; Razorpay handles intl-card forex.
- **NRI subscription + FEMA (P0):** RBI purpose code on receipts, FIRC capture; CA-reviewed until automated.
- **Virtual Date system (P0):** 30-min scheduled Daily.co video with a Mastra `DateActivityHost` (Sonnet) running icebreaker→values→lifestyle→wrap; both opt-in to share contact; never sees the other party's private answers; hard 30-min cap (Bull auto-close) to control cost.
- **Churn re-engagement (P1):** wire the existing Phase-3 churn model to push via Bull (cap 2 msgs/user/week).
- **Biometric login (P1):** `expo-local-authentication`, PIN fallback.

**Real AI agents (Mastra):** DateActivityHost (Sonnet), ChurnSaver (selects re-engagement template).
**Plain services:** TimezoneMatchmaker ranking, CurrencyOracle (RBI FX, cached), NRIComplianceWatcher (flags FIRC/purpose-code review).

**Complexity / timeline:** **XL · ~10–14 weeks** (parity alone is months; FEMA + store review add external time). PWA hardening is a smaller parallel win.
**Top risks:** Apple rejects dating-adjacent app (lead with arranged-marriage/family framing + parent-mode demo); forex surprises NRI users (show "settles in INR ₹X" + live rate at checkout); FEMA purpose-code errors (CA review every receipt until 100 clean); Daily.co cost spikes (hard cap + auto-close); RN/React version drift; Tier-2 Android low-RAM crashes (Hermes, image downsampling).
**Monetization unlocked:** NRI premium tier (~₹2,499/3mo); in-app subscriptions.

---

## Phase 8 · Destination Weddings · National Infrastructure

**Goal:** Capture the destination wedge (avg destination spend ~₹58L; ~1 in 4 weddings; 60%+ of ₹1cr+ weddings) by being the **technology spine** under planners + hotels — not a re-seller. Plus national-readiness + final handover. **Hotel partnerships are Colonel-led BD measured in months; this phase is partnership-gated.**

**Launch gate / prereqs:** Phases 5–7 shipped; Colonel-led outreach to hotel chains (Marriott/Taj/Tivoli); affiliate/RFQ path live before any deep API.

**Headline features**
- **Destination discovery (P0):** filter by budget/guests/season/theme; every result carries lead-time (Udaipur palaces 9–12 months), monsoon-safe flag (Goa Jun–Sep), and a state-specific permission checklist (Rajasthan NOCs, sound cut-off).
- **Hotel block booking — affiliate/RFQ first (P0):** start with referral links + a `HotelBlockNegotiator` (Mastra, Sonnet) drafting RFQ emails for **human approval**; deep API integration only after partnerships sign.
- **Guest travel coordination (P0):** group fare/hotel aggregation; logistics PDF for 50+ guest weddings (IRCTC/airline APIs when available, manual until then).
- **Multi-day itinerary builder (P0):** drag ceremony cards onto a 3-day timeline; auto-resolve vendor conflicts.
- **3D venue visualisation (P1, web-first):** `<model-viewer>` + lazy three.js on web; defer on mobile in v1; 1080p cap to control R2 spend.
- **Post-marriage services (P1):** honeymoon affiliate, anniversary reminders, referral pathway.
- **PDF reports (P0):** vendor revenue / couple budget reconciliation / admin stats.
- **Final handover docs (P0):** `OPERATIONS.md`, `INCIDENT-RESPONSE.md`, `SECURITY.md`, `COMPLIANCE.md`, `RUNBOOK.md` generated by a `HandoverScribe` agent and reviewed twice with diff.

**Success criteria — reframed to product-controllable.** The earlier plan's "3 chains signed / 10 weddings in 30 days" depend on a BD motion you don't own. Measure instead: discovery flow shipped + N venues catalogued + RFQ flow live + handover docs signed off. Business outcomes are Colonel's to drive.

**Real AI agents (Mastra):** HotelBlockNegotiator (Sonnet, human-approved sends), HandoverScribe (Sonnet, repo-grounded docs).
**Plain services:** DestinationCurator ranking, TravelLogistician, MonsoonOracle (rules JSON).

**Complexity / timeline:** **XL · partnership-led, effectively ongoing.** Product surface is buildable in weeks; partnerships and BD set the real pace.
**Top risks:** partnerships slow (affiliate/RFQ first); 3D R2 spend (caps, lazy load); monsoon false-positives (override + disclaimer); multi-region eventual-consistency bugs (keep single Postgres primary, read replica for reads only); handover gaps (run HandoverScribe twice).
**Monetization unlocked:** destination/hotel commission; post-marriage upsell.

---

## 6. Cost ladder (spend only when a metric forces it)

The current < $15/mo stack holds far longer than the earlier plan assumed. Trigger upgrades on metrics, not phases:

| Upgrade | Trigger (the metric that justifies it) | Note |
|---|---|---|
| `pgvector` extension | Match-feed compute becomes a UX problem as profiles grow | **Cheapest, earliest** — no new service, on existing Postgres (Phase 5) |
| MongoDB M0 → M10 | M0's 512 MB or connection cap actually hit (watch Atlas) | Not before |
| Redis adapter hardening | Multi-instance deploy needed for socket throughput | Already a Phase 4.5 fix |
| PG read replica | Read latency / primary CPU forced by real traffic | Reads only; keep single primary |
| Second Railway region | Real users in multiple regions **and** p95 from a region misses target | Last, not first |
| BSP / WhatsApp spend | Marketing volume justifies it | Daily budget cap always on |

---

## 7. Cross-cutting (applies to all four phases)

- **Eval harness scales with you:** every new Mastra agent gets a golden-set eval in the CI harness built in Phase 4.5 before it ships. This is the core "AI-first" discipline.
- **Webhook record/replay harness:** every new external integration (Razorpay Route/Payouts, NBFC, WhatsApp, eSign, hotel APIs) gets a recorded canonical payload + replay test. Inbound callbacks are where integrations break.
- **Mock-first always:** any external service ships behind the existing flag system, real creds swapped via the Phase 4.5 swap runbook — never a code rewrite.
- **Migration discipline:** generate → idempotent hand-edit → journal → psql apply → verify. Never `db:push` to prod.
- **Money is BigInt paise + currency** everywhere, from the `Money` type, not floats.
- **Sub-agent build mode:** single-agent sequential default; worktrees only for zero-overlap; verification protocol (type-check → build → browser → click → network → console) on every Server Component change.

## 8. Monetization stack (gated unlocks, not a switch)

Matchmaking subs (incl. NRI tier) · vendor commission · lead fees · off-season utilization commission (P5) · B2B/institutional commission (P5) · marketing SaaS ₹999 (P6) · multi-city placements (P6) · loan referral (P6, gated) · insurance referral (P6) · hotel/destination commission (P8) · post-marriage upsell (P8) · featured listings/ads.

> Caveat: market figures (destination ₹58L avg, ~1-in-4 weddings, NRI LTV) are survey/projection-based — directional, hedge customer-facing claims. RBI digital-lending rules evolve — quarterly compliance review is mandatory before any lending launch. Verify partner pricing (NBFC rates, WhatsApp per-message, hotel minimums) against live sources at the time each phase is greenlit.
