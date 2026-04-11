# Smart Shaadi — Master Development Plan
## Solo Developer · AI-Assisted Build · 6 Months to National Platform

---

## The Strategy in One Sentence

Build one module per day in Phases 1–2, one module per two days in Phases 3–8, ship something deployable every phase, and never start a session without reading CLAUDE.md.

---

## Before You Write a Single Line of Code

### Week 0 — Registrations (Do These Now, They Have Lead Times)

| Action | Lead Time | Do It |
|--------|-----------|-------|
| Razorpay merchant account | 3–5 business days | **Now** |
| Digilocker API application | 5–10 business days | **Now** |
| MSG91 DLT sender registration | 5–10 business days | **Now** |
| AWS account setup | Instant | **Now** |
| Cloudflare account + R2 bucket | Instant | **Now** |
| Railway account + project | Instant | **Now** |
| Vercel account + project | Instant | **Now** |
| GitHub private repo | Instant | **Now** |

These are not optional. Missing Razorpay or Digilocker activation blocks Week 1 development. Register them before you create the monorepo.

---

## The Daily System (Non-Negotiable)

### Morning (7:00–8:00)
```
1. Read CLAUDE.md — specifically the "Current Status" block
2. Open ROADMAP.md — confirm today's target module
3. Update CLAUDE.md status block if starting a new week
4. Run: docker compose up -d (start infrastructure)
5. Run: pnpm dev (start all services)
```

### Session Start (8:00–8:30) — Research First
```
Before touching any file:
"Read all files in apps/api/modules/[today's module].
 Summarize what already exists, then propose an implementation plan."
```
Never skip this. It prevents 80% of rework.

### Plan Mode (8:30–9:00) — Shift+Tab in Claude Code
```
"Create a detailed implementation plan for [module].
 List: files to create, files to modify, DB changes, API endpoints,
 breaking changes, and risks. Do NOT write code yet."
```
Review the plan. Correct misunderstandings. Confirm.

### Deep Build (9:00–12:00 and 13:00–16:00)
```
Implement. Cursor for flow state, Claude Code for architecture.
/compact at 10:30 and 14:30 — non-negotiable.
Git checkpoint before any risky operation.
```

### Integration & Testing (16:00–17:30)
```
Wire the module to existing code.
Run: pnpm type-check
Run: pnpm test
Push to PR → get Vercel/Railway preview URL.
```

### Session End (17:30–18:00)
```
Update ROADMAP.md — mark module complete.
Update CLAUDE.md current status if phase/week changed.
git add -A && git commit -m "feat(module): description"
Push. Verify preview deploys.
Friday: record Loom, post to Notion client portal.
```

---

## Claude Code Power Rules

1. **Plan Mode before every module** — Shift+Tab — no exceptions
2. **Research before planning** — always ask Claude Code to read relevant files first
3. **/compact every 60 minutes** — context degradation is invisible and costs hours
4. **Git checkpoint before risky ops** — `git add -A && git commit -m 'checkpoint'`
5. **Subagents for parallel work** — tests + JSDoc + types all at once
6. **Never exceed 1000 lines per session** — break large features into PR-sized chunks
7. **Use slash commands** — `/new-module`, `/fix-bug`, `/week-end`, `/ai-module`
8. **Sonnet for 95% of work** — switch to Opus only for hard architecture problems
9. **Update CLAUDE.md when stack changes** — future sessions thank you
10. **Close Cursor between unrelated tasks** — `/clear` to reset context

---

## Phase 1 — Day by Day (Weeks 1–5, ~25 Days)

### Week 1 — Foundation

**Day 1–2: Infrastructure & Auth**
```
Morning:  Create monorepo (pnpm + Turborepo)
          Add packages: types, schemas, db
          Add apps: web (Next.js), api (Express), ai-service (FastAPI)
          Docker Compose up and verified
          GitHub Actions CI pipeline working
Afternoon: Better Auth setup — phone OTP + email + JWT
          PostgreSQL schema: users, sessions, otp_verifications
          Test: can register with phone, receive OTP, verify, get token
Evening:  /week-end check. Commit: "feat(auth): phone OTP auth complete"
```

**Day 3–4:
 & Identity**
```
Morning:  Digilocker KYC flow (if API approved) OR manual upload fallback
          AWS Rekognition photo fraud detection endpoint
          Duplicate account detection (phone + device fingerprint)
Afternoon: Admin review queue for unverified profiles
          Verified badge system
          Test: full KYC flow end-to-end
Evening:  Commit. Update ROADMAP.
```

**Day 5: Profile (Personal + Safety Mode)**
```
Morning:  Drizzle schema: profiles, profile_photos, community_zones
          MongoDB Mongoose model: ProfileContent
          Profile creation form (Server Action in Next.js)
Afternoon: Safety Mode — contact gating logic
          Photo upload to R2 via pre-signed URLs
Evening:  Commit.
```

### Week 2 — Profiles & Community

**Day 6–7: Profile (Family, Career, Lifestyle)**
```
Family details, education, profession, income
Lifestyle fields + hyper-niche tag system
Partner preferences form
```

**Day 8–9: Profile (Horoscope + Community Zones)**
```
Horoscope data entry (Rashi, Nakshatra, DOB/TOB/POB)
Community zone assignment
Language preference field
LGBTQ+ configurable flag (admin-level toggle)
Profile completeness percentage calculator
```

**Day 10: Profile Photos & Profile View**
```
Multi-photo upload with R2 pre-signed URLs
Photo reordering
Profile view page (another user's profile)
```

### Week 3 — Matchmaking Core

**Day 11–12: Reciprocal Matching Engine**
```
Hard filter application (age, religion, location radius, income)
Bilateral check — candidate must pass requester's filters AND requester must pass candidate's
Match feed API endpoint
Redis cache for pre-computed feeds
```

**Day 13–15: Guna Milan Calculator**
```
THIS IS 3 DAYS — do not compress.
apps/ai-service/services/guna_milan.py
Implement all 8 Ashtakoot factors with lookup tables
Mangal Dosha detection
Pytest suite — 100% coverage, edge cases
POST /ai/horoscope/guna endpoint
Integration with match score display
```

### Week 4 — Match Requests & Chat

**Day 16–17: Match Requests + Privacy**
```
Send/accept/decline/withdraw request flows
Block and report
Contact visibility controls
Notifications triggered by all state changes
```

**Day 18–20: Real-Time Chat**
```
Socket.io server setup — namespace /chat, rooms by matchRequestId
Message persistence to MongoDB chats collection
Photo sharing in chat (R2 pre-signed upload)
Read receipts
Hindi-English translation (POST /ai/chat/translate)
Typing indicator
```

### Week 5 — Vendors, Booking, Payments

**Day 21–22: Vendor Discovery**
```
Vendor listing with category + city filter
Vendor portfolio page (fetched from MongoDB)
Search with pagination
```

**Day 23–24: Booking System**
```
Full booking state machine: PENDING → CONFIRMED → COMPLETED / CANCELLED
Vendor availability check before confirming
Customer and vendor booking views
Cancellation flow
```

**Day 25: Payments + All Dashboards + Production Launch**
```
Razorpay integration (test → live keys)
Webhook handler (verify signature, update payment status)
Invoice PDF generation (pdfkit)
Refund handling
Customer dashboard
Vendor dashboard
Admin dashboard
End-to-end QA
PRODUCTION DEPLOY 🚀
```

---

## Phase 2 — Day by Day (Weeks 6–9, ~20 Days)

**Week 6 (Days 1–5): Wedding Planning Core**
- Day 1–2: Wedding plan creation, budget tracker, Drizzle schema
- Day 3–4: Kanban task board, auto-checklist from wedding date
- Day 5: Mood board + theme selection, MongoDB wedding_plans model

**Week 7 (Days 6–10): Family + Guests**
- Day 6–7: Family member access, role-based permissions, task assignment
- Day 8–9: Guest list management, RSVP tracking, meal preferences
- Day 10: Room allocation, digital invitation builder

**Week 8 (Days 11–15): Communication + Payments**
- Day 11–12: In-platform video calls (Daily.co SDK)
- Day 13–14: Escrow payment system — all state transitions, Bull queue for 48h auto-release
- Day 15: Rental module — catalogue, booking, return tracking

**Week 9 (Days 16–20): Multi-Event + Polish**
- Day 16–17: Multi-event booking extension (corporate, festival, community)
- Day 18–19: Firebase push notifications, notification preferences
- Day 20: Pre-wedding ceremony modules (Haldi, Mehndi, Sangeet) + Muhurat selector + Phase 2 QA

---

## Phase 3 — Day by Day (Weeks 10–11, ~10 Days)

> Use `/ai-module` slash command for all Python/FastAPI work.

**Week 10 (Days 1–5): AI Features**
- Day 1–2: FastAPI AI service deployed, data pipeline, Conversation Coach
- Day 3–4: Emotional Compatibility Score, profile sentiment tracking
- Day 5: AI Profile Optimizer (photo + bio scoring)

**Week 11 (Days 6–10): More AI + Vendor Engine**
- Day 6–7: Marriage Readiness Score, Reputation Score
- Day 8–9: Family Compatibility Mode, Parent Mode, Divorcee Support
- Day 10: Behaviour-Based Matching signal layer + Churn Detection + Vendor Engine Foundation + QA

---

## Phase 4 — Day by Day (Weeks 12–13, ~10 Days)

**Week 12 (Days 1–5): Revenue + Language**
- Day 1–2: Subscription tiers (Free/Standard/Premium), Razorpay Subscriptions
- Day 3–4: Feature gating per tier
- Day 5: Full Hindi UI + i18n framework

**Week 13 (Days 6–10): SEO + Hardening**
- Day 6–8: Auto-SEO engine (LLM-generated community × city pages, structured data, sitemap)
- Day 9: Dynamic pricing foundation, Referral programme, Vendor lead gen fee, GDPR controls
- Day 10: Analytics dashboard + Full security audit + Load testing + Production deployment 🚀

---

## Expansion Plan — Phase 5–8 (Months 4–6)

> Begin these phases after Phase 4 is live and client confirms go-ahead.

**Phase 5 (Month 4):** Full Vendor Utilization Engine, Calendar Intelligence, Dynamic Pricing (full), Documentation & Compliance, B2B Self-Serve

**Phase 6 (Month 5):** NBFC loan referral flow, Wedding insurance integration, Auto-Marketing Engine (n8n + Claude API), Multi-city vendor network, WhatsApp Business API

**Phase 7 (Month 6 first half):** React Native + Expo mobile apps, NRI & international matching, Virtual Date System, Advanced Churn Recovery ML

**Phase 8 (Month 6 second half):** Destination Wedding Module, Post-marriage services, National auto-scaling infrastructure, PDF reporting, Project handover

---

## Weekly Cadence

| Day | Focus |
|-----|-------|
| Monday | New module — research + plan |
| Tuesday | Core implementation |
| Wednesday | Tests + integration |
| Thursday | Edge cases + polish |
| Friday | PR → preview deploy → Loom update → /week-end |
| Saturday | Overflow / complex modules |
| Sunday | Architecture review, CLAUDE.md update, next week planning |

---

## When Stuck

**Stuck on Claude Code output quality:**
- Run `/compact` — context likely degraded
- Break the task into smaller PR-sized chunks
- Prefix: "Research all files in [area] first, then propose a plan"

**Stuck on a bug:**
- Use `/fix-bug` slash command
- Write a failing test that reproduces the bug first
- Never fix symptoms — find root cause

**Stuck on architecture:**
- Switch to Opus for the planning session only
- Document the decision in ARCHITECTURE.md as an ADR
- Switch back to Sonnet for implementation

**Third-party API not responding:**
- Always have a fallback path (manual upload if Digilocker is down)
- Never block development on external API approval
- Mock the API for development, add real integration once approved

---

## Commit Message Format

```
feat(module): description of what was added
fix(module): description of what was broken and how it was fixed
chore: description of non-feature work
refactor(module): description of what was restructured
test(module): description of tests added
docs: description of documentation updated
```

Examples:
```
feat(auth): phone OTP login with Better Auth
feat(matchmaking): Guna Milan calculator all 8 Ashtakoot factors
fix(escrow): auto-release Bull job not firing on completed bookings
feat(chat): Hindi-English real-time translation in chat messages
chore: update CLAUDE.md Phase 2 status
```

---

## Monthly Checklist

**End of Month 1 (Phase 1 complete):**
- [ ] Platform is live and accessible at production URL
- [ ] At least one real vendor booking completed end-to-end
- [ ] Razorpay payment confirmed in live mode
- [ ] Error rate in Sentry < 1% of requests
- [ ] Loom update sent to client

**End of Month 2 (Phase 2 complete):**
- [ ] Wedding planning suite used by at least one test couple
- [ ] Escrow payment held and released successfully
- [ ] Guest RSVP flow tested end-to-end
- [ ] PostHog funnel showing matchmaking → chat → booking conversion

**End of Month 3 (Phases 3–4 complete):**
- [ ] All 6 AI matchmaking features live
- [ ] Subscription payment recurring in Razorpay
- [ ] At least 10 Auto-SEO pages indexed in Google Search Console
- [ ] Platform load tested at 500 concurrent users without degradation
- [ ] Client demo of complete core platform
- [ ] Phase 5–8 scope confirmed with client
