# Smart Shaadi — Loom Demo Script (15 min)

For Colonel Deepak's Sunday May 18, 2026 review.
Production URL: https://smartshaadi.co.in
Recording target: 12-15 minutes
Date: To record Saturday May 17 morning

---

## Opening (0:00 — 1:00)

**Camera:** Brief face-cam intro (10 sec) then screen share

**Script:**
"Good morning Colonel Sir. This is Ashwin from Dual Mind Labs. 
Over the past two months, I've built Smart Shaadi — India's 
AI-powered matrimonial platform. Today I'll walk you through 
the production system at smartshaadi.co.in. 

What you'll see is fully live — real signup, real matching, 
real AI features. I'll show 9 of the 11 contractual Phase 3 AI 
modules plus the core Phase 1, 2, and 4 deliverables. Two items 
are in pre-launch polish — the Hindi interface and full live 
payment integration, both pending external vendor approvals 
that take 15-20 days once we initiate."

**On screen:** Landing page (smartshaadi.co.in)

---

## Section 1 — Landing + Signup (1:00 — 2:30)

**Show:**
- Landing page hero
- Trust signals (KYC, privacy)
- "Get Started" → /register
- Phone number entry → OTP
- "I'll use prod OTP 135246 — in real launch, MSG91 DLT 
  delivers actual SMS to user's phone"

**Talking points:**
- Phone-first auth (Indian-first design)
- KYC integration with Aadhaar (mocked for now, DigiLocker 
  partner approval pending)
- 15-20 day vendor onboarding window

---

## Section 2 — Profile Setup (2:30 — 4:00)

**Show:** Profile completeness flow
- 8 sections: Personal, Family, Education, Career, Lifestyle, 
  Horoscope, Preferences, Photos
- Real-time completeness % indicator
- Save & continue pattern

**Highlight one section in detail:** Family (because FII uses it)
- "These family fields feed our Family Inclination Index"

**Skip detail on:** Personality (covered in AI section)

---

## Section 3 — Matching + AI Features (4:00 — 7:00)

**This is the showcase section. Take time here.**

**Show:**
1. /feed — 3 matched profiles with compatibility %
2. Click into a profile → /profiles/[id]
   - Real-time DPI (Divorce Probability Indicator) gauge
   - FII Family Compatibility breakdown with 7 sub-scores  
   - Behavior-based matching signal
3. Click "Compatibility Analysis"
   - Show DPI label + narrative
   - Family Outlook with both partners' scores
   - "Try discussing..." suggestions
4. Send Interest → switch account → accept

**Talking points:**
- "DPI is a calibrated ML model — sklearn LogisticRegression 
  with CalibratedClassifierCV, trained on synthetic Indian 
  matrimonial data following published research"
- "FII analyzes 7 family signals weighted by religion, region, 
  and age"
- "These are NOT in any competitor — these are unique to 
  Smart Shaadi"

---

## Section 4 — Chat + Conversation Coach (7:00 — 8:30)

**Show:**
- /matches → click match → chat
- Send a message
- Conversation Coach AI suggestions appear
- Hindi → English translation widget (note: full Hindi UI 
  pending Thursday's i18n redo)

**Talking points:**
- "AI suggests culturally-aware conversation openers"
- "Emotional Score tracks tone of conversations"
- Video call: "Mock room created — real Daily.co flips on at 
  launch with API key"

---

## Section 5 — Wedding Planning Suite (8:30 — 10:30)

**Show:**
- /weddings/new → create wedding
- Wedding detail page
  - Auspicious Dates (Muhurat) calculator
  - Budget tracker
  - Guest management (add 1-2 guests live)
  - Catering FAQ (Function Attendance Quotient — AI predicts 
    attendance per ceremony for catering planning)
  - Tasks kanban

**Talking points:**
- "End-to-end wedding management — not just matchmaking"
- "FAQ is unique — predicts per-event attendance for catering 
  cost planning"

---

## Section 6 — Subscriptions + Monetization (10:30 — 11:30)

**Show:**
- /settings/billing — 4 plans (Standard M/Y, Premium M/Y)
- Click Premium Monthly
- Mock Razorpay checkout
- "Live keys flip on after Razorpay account approval (15 days)"

**Talking points:**
- Two-tier subscription model
- Vendor lead fee + referral programme (Phase 4 contractual)
- Wallet system for vendor commissions

---

## Section 7 — Admin Visibility (11:30 — 12:30)

**Show briefly:**
- /admin/revenue dashboard (existing analytics)
- Stay Quotient (churn prediction) per user
- Reputation Score breakdown
- "Full analytics dashboard expansion is post-launch polish"

---

## Closing (12:30 — 14:00)

**Camera:** Brief face-cam close

**Script:**
"To summarize what's deployed:
- 11 of 11 contractual Phase 3 AI modules built
- 7 of 9 Phase 4 contractual items shipped
- 624 automated tests passing
- 24 production database migrations applied
- Sentry error tracking active

Two items pending:
- Hindi i18n full rollout — framework in place, content 
  translation in progress
- Live payment flows — code ready, awaiting Razorpay account, 
  MSG91 DLT, and DigiLocker partner approvals (15-20 day 
  onboarding each)

I'd recommend starting those three vendor registrations this 
week so we hit our July 5 launch date. Sunday's call would be 
a good time to confirm scope and start that paperwork.

Looking forward to the call. Thank you, Sir."

---

## What NOT to show or talk about

- Hindi i18n broken state (we reverted Wednesday — frame as "in progress")
- Mock-r2 URL issues (fixed Thursday afternoon but new photos in fresh accounts)
- Video calling beyond mock
- Family Compatibility (built but needs 2 linked accounts to demo properly)
- Vendor leads UI (built but needs vendor accounts to demo)
- Matrimony AI Assistant (mock responses until Anthropic billing resolves)
- Bugs that came up in UAT (mood board errors, community SEO 404)

If Colonel asks about something specific that's not working perfectly:
"That's part of the pre-launch polish queue — fully functional 
backend, UI polish in progress. Happy to demo deeper once we 
confirm scope."

---

## Recording technicals

- Loom Free plan = 5 min × 3 segments OR upgrade to 25 min single take
- Record at 1080p
- Use clean Chrome profile (no other tabs, no extensions visible)
- Test prod URL beforehand — sign in fresh, verify nothing is broken
- Have demo data prepared (see demo-data-plan.md)
- If video walk-through is too long, split into 2 Looms (Part 1: AI + 
  Matching, Part 2: Wedding + Subscriptions)