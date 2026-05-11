# Smart Shaadi — Demo Script for Colonel Deepak

**Date:** 11 May 2026
**Phase:** 4 (subscriptions + Auto-SEO + Sentry) shipped
**Audience:** Colonel Deepak (project owner)
**Duration:** 15 minutes
**Presenter:** Ashwin Hingve

---

## 1. Demo Flow (15-min script)

### Beat 1 — "Sign up as a new user" (2 min)

- Navigate to `https://smartshaadi.co.in/register`
- Pick **role: Bride / Groom** (INDIVIDUAL)
- Enter phone `+919999999999` → tap **Send OTP**
- Enter OTP `135246` → land on dashboard
- Talk track: *"Phone-only signup — no email required. OTP via MSG91 (mocked
  for demo until DLT registration). KYC is scaffolded, real DigiLocker plugs in
  when partner approval lands."*

### Beat 2 — "Complete profile" (2 min)

- Click **Complete Profile** → step through the 6 sections:
  Personal · Family · Lifestyle · Profession · Education · Partner Preferences
- Talk track: *"Profile completeness drives feature unlocks. Below 60% → no
  feed. 60-80% → limited matches. 80%+ → full matchmaking. This forces real
  data quality up-front."*
- Save → completeness bar fills to 100%

### Beat 3 — "Browse the match feed" (2 min)

- Click **Discover / Feed**
- Show ranked profile cards with:
  - **Compatibility tier** (excellent / good / fair)
  - **Guna Milan score** (Vedic 36-point system, deterministic math)
  - **DPI score** (ML-predicted Demographic Profile Index)
  - **Verified badge**
- Talk track: *"Every card is reciprocal — both sides pass each other's hard
  filters. Guna is real Vedic math, not vibes. DPI is a calibrated ML
  classifier. Photos blur until contact unlock."*

### Beat 4 — "Send interest" (1 min)

- Click into a profile → tap **Send Interest**
- Show the modal: optional message, daily quota counter
- Talk track: *"Match requests are gated by subscription tier. Free users get
  3/day. Premium gets unlimited. Quotas reset at 00:00 IST via cron."*

### Beat 5 — "View compatibility analysis" (2 min)

- Click **Compatibility Details** on a match
- Show the breakdown page:
  - **DPI** with feature contributions (income, education, location)
  - **FII** (Family Influence Index — 7-signal weighted) with Sonnet
    narrative explanation
  - **Guna Milan** all 8 Ashtakoot factors
- Talk track: *"FII is unique — every other matrimonial app ignores the family
  layer. We score 7 signals (parental occupation, sibling status, family
  reputation, etc.) and ask Sonnet to write a one-paragraph narrative for
  the user. Real LLM call, real cost-tracked via Helicone."*

### Beat 6 — "Start a chat" (1 min)

- (After mutual interest accept) tap **Message**
- Send a few messages
- Show the **Conversation Coach** panel suggesting opener prompts
- Talk track: *"Conversation Coach is Sonnet-powered. Suggests 3 contextual
  openers based on the other person's profile + interests. Reduces blank-page
  paralysis — known cause of match-to-message drop-off."*

### Beat 7 — "Plan a wedding" (3 min)

- Switch to **Wedding** section (top nav)
- Show the wedding overview page:
  - **Ceremonies tab** — Sangeet / Mehendi / Haldi / Wedding (sub-events with
    dates, venues, budgets)
  - **Muhurat card** — auto-suggested auspicious times based on horoscope
  - **Guest list** — with FAQ-driven catering estimates
    *("How many guests usually attend a Maharashtrian wedding ceremony?"
    answered by the calibrated Gradient-Boost FAQ classifier)*
  - **Vendor portfolio links** (if vendors associated)
- Talk track: *"Wedding planning is the second product. Same login, same
  household. Bride/Groom plus family members can collaborate. AI-assisted
  budgeting — Stay Quotient predicts which vendors a couple is likely to
  retain through the wedding cycle."*

### Beat 8 — "Subscriptions" (2 min)

- Navigate to `/settings/billing`
- Show the 4 plans:
  - **Standard Monthly** — ₹499 / mo
  - **Standard Yearly** — ₹4,999 / yr (2 months free)
  - **Premium Monthly** — ₹999 / mo
  - **Premium Yearly** — ₹9,999 / yr (2 months free)
- Click **Subscribe** on Standard Monthly → mock Razorpay checkout opens
- Talk track: *"Razorpay integration is wired but env-flag gated to mock mode
  (`RAZORPAY_LIVE=false`). Single env flip — `RAZORPAY_LIVE=true` plus the 3
  Razorpay keys — and we're billing real customers. Webhooks tested,
  idempotency in place, grace-period cron at 02:00 IST."*

---

## 2. Test Credentials

| Account | Phone | OTP | Role |
|---|---|---|---|
| User A | `+919999999999` | `135246` | INDIVIDUAL (FEMALE) |
| User B | `+918120684036` | `135246` | INDIVIDUAL (MALE) |

Both are seeded in production via `pnpm tsx apps/api/scripts/seed/full-demo.ts`.

---

## 3. URLs

| Surface | URL |
|---|---|
| Production web | https://smartshaadi.co.in |
| Production API | https://api.smartshaadi.co.in |
| AI service (internal) | `https://ai.smartshaadi.co.in` (auth-walled) |
| Sentry org | https://smart-shaadi.sentry.io |
| Railway project | (ask Ashwin for invite link) |
| Vercel project | https://vercel.com/smart-shaadi/smart-shaadi-web |

---

## 4. Known Limitations to Mention Up-Front

State these openly — they are **business gates, not engineering gaps**:

1. **Mock Razorpay** — Real payment integration pending company registration +
   Razorpay KYC. Code is production-ready; flip one env var to ship.
2. **Mock MSG91 SMS** — DLT (Distributed Ledger Technology) registration with
   TRAI pending. OTPs return as JSON in dev; real SMS once approved (~2 weeks
   typical).
3. **Mock DigiLocker KYC** — Partner approval pending. UI flow is built;
   verification status flips on real callback.
4. **6 of ~573 API tests skipped** — `engine.test.ts` flakes due to Mongoose
   buffering in test isolation. Addressed in Phase 4 Day 3 hardening pass
   (commit `test(api): fix engine.test.ts flakes`).

---

## 5. Talking Points — Lead With These

- ✅ **6 AI features live in production**: Conversation Coach, Emotional
  Score, DPI, FII, FAQ, Stay Quotient
- ✅ **22 programmatic SEO landing pages** indexed by Google (6 communities
  × cities × castes pivot)
- ✅ **Subscription system payment-ready** — single env flip away from live
  billing
- ✅ **End-to-end matching with real ML predictions** — calibrated probability
  outputs, not raw model scores
- ✅ **Sentry error tracking active across all 3 services** — api,
  ai-service, web — verified capturing
- ✅ **Production runbook + deploy procedure documented** —
  `docs/RUNBOOK.md`, `docs/monitoring/betterstack-setup.md`

---

## 6. Pre-Demo Checklist (15 min before)

```bash
# Verify both seed users exist + can log in
curl -X POST https://api.smartshaadi.co.in/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919999999999"}'

# Expect: { "success": true, "data": { "requestId": "..." } }

# Verify feed endpoint returns candidates (post-login)
# Use the returned JWT in Authorization header

# Confirm Sentry is receiving events
# https://smart-shaadi.sentry.io → Issues → filter by env=production

# Confirm subscriptions page loads (no mock-store crash)
# Open https://smartshaadi.co.in/settings/billing in incognito
```

---

## 7. Q&A Prep — Likely Questions

**Q: When can we go live with real payments?**
A: After Razorpay company registration completes (paperwork in Colonel's
queue). Engineering side: 30 minutes — flip `RAZORPAY_LIVE=true`, paste 3
keys into Railway, redeploy. Webhooks are already tested against staging.

**Q: How accurate is the matching?**
A: Guna Milan is 100% deterministic (Vedic math). DPI achieves ~78%
accuracy on labelled training data with calibrated probability output. FII
combines 7 signals + LLM narrative for explainability. We log every match
score so we can A/B-test ranking changes against retention.

**Q: What happens if the AI service goes down?**
A: Matchmaking degrades gracefully — falls back to Guna-Milan-only ranking.
Conversation Coach + DPI widgets render an empty state. No request fails.
Sentry alerts on 5xx spikes via BetterStack.

**Q: What's next?**
A: Phase 5 — Family Member dashboard (parents/relatives collaborate on
wedding). Phase 6 — Vendor marketplace MVP. Phase 7 — React Native mobile
(Expo SDK 55).

---

**End of script.**
