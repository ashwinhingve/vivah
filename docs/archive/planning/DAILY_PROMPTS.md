# Smart Shaadi — Daily & Weekly Prompt Library
# Every prompt is copy-paste ready for Claude Code

---

## SESSION STARTER (Paste at start of EVERY Claude Code session)

```
Smart Shaadi — session start.

Status:
- Phase: [1 / 2 / 3 / 4]
- Week: [1–13]
- Today's focus: [exact module name]
- Mock services: USE_MOCK_SERVICES=true (OTP · KYC · Payments)

Before anything:
1. Read CLAUDE.md fully — especially Architecture Rules and Current Status
2. Read all files in [today's module area — e.g. apps/api/modules/matchmaking/]
3. Check ROADMAP.md for today's specific tasks
4. Tell me what already exists, then propose a plan

Do not write code until I approve the plan.
```

---

# PHASE 1 — MONTH 1 (Weeks 1–5)

---

## WEEK 1 — Foundation & Authentication

### Day 1–2: Infrastructure & Monorepo

**Morning prompt:**
```
Read CLAUDE.md fully.

Scaffold the complete Smart Shaadi monorepo. Everything is already in place:
- package.json, turbo.json, pnpm-workspace.yaml at root
- packages/db/schema/index.ts (complete Drizzle schema)
- docker-compose.yml in infrastructure/

Create the missing app scaffolds:
1. apps/web — Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui
2. apps/api — Node.js, Express, TypeScript strict, proper module structure
3. apps/ai-service — Python 3.11, FastAPI, pyproject.toml, folder structure only
4. packages/types — shared TypeScript types, empty index.ts
5. packages/schemas — shared Zod schemas, empty index.ts

Each app needs: correct tsconfig.json, package.json, ESLint config.
No feature code — just correct scaffolding.

Plan first (list every file), wait for approval.
```

**Afternoon prompt:**
```
Infrastructure is scaffolded. Now set up GitHub Actions CI pipeline.

Create .github/workflows/ci.yml that runs:
1. pnpm lint
2. pnpm type-check
3. pnpm test (Vitest, with PostgreSQL and Redis service containers)
4. pnpm build
5. On PR only: pnpm e2e (Playwright)

Also verify docker compose up -d works and all 4 containers are healthy.
Run pnpm db:push — confirm schema pushes to PostgreSQL without errors.

Show me the CI file, then verify the database connection.
```

**End of day commit:**
```
git add -A && git commit -m "feat(infra): monorepo scaffold + CI pipeline + database connected"
```

---

### Day 3–4: Authentication Module

**Prompt:**
```
Read CLAUDE.md and ROADMAP.md Week 1 tasks.

Build the complete Authentication module with MOCK OTP.

In this exact order:
1. Better Auth setup — phone OTP + email + JWT (15m access / 30d refresh httpOnly cookie)
2. Six roles: INDIVIDUAL, FAMILY_MEMBER, VENDOR, EVENT_COORDINATOR, ADMIN, SUPPORT
3. Use Drizzle schema already in packages/db/schema/index.ts — users, sessions, otp_verifications
4. Mock OTP service: USE_MOCK_SERVICES=true → always accepts 123456, logs to console
5. Endpoints:
   POST /api/v1/auth/register
   POST /api/v1/auth/login/phone
   POST /api/v1/auth/verify-otp  (returns access token + sets refresh httpOnly cookie)
   POST /api/v1/auth/refresh
   POST /api/v1/auth/logout
6. Middleware: authenticate() and authorize(roles[])
7. Standard response envelope: { success, data, error, meta }
8. Vitest unit tests: OTP verification, JWT generation, role-based access

Plan first. List every file. Wait for approval.
```

---

### Day 5: KYC Module (Mock)

**Prompt:**
```
Auth is complete. Build KYC and Identity Verification — all mocked.
Mock → real is a single ENV variable. No code rewrite.

1. Mock Digilocker: USE_MOCK_SERVICES=true → returns { verified: true, name: "Test User" }
   Real: actual Digilocker API call with DIGILOCKER_CLIENT_ID credentials

2. Mock photo fraud: USE_MOCK_SERVICES=true → returns { is_real: true, confidence: 99 }
   Real: AWS Rekognition detect_faces()

3. Duplicate detection (no mock needed — uses our own DB):
   Check phone uniqueness in users table
   Device fingerprint check (user-agent pattern)
   Flag duplicates for admin review — never auto-block

4. verification_status: PENDING → VERIFIED | REJECTED | MANUAL_REVIEW
   Admin override capability

5. Admin review queue:
   GET  /api/v1/admin/kyc/pending
   PUT  /api/v1/admin/kyc/:id/approve
   PUT  /api/v1/admin/kyc/:id/reject

6. KYC endpoints:
   POST /api/v1/kyc/initiate
   POST /api/v1/kyc/photo
   GET  /api/v1/kyc/status

7. NEVER store raw Aadhaar — status only in PostgreSQL

8. Vitest: all status transitions, mock vs real service switching

Plan first. Wait for approval.
```

---

## WEEK 2 — Profile System

### Day 6–7: Profile Core + Safety Mode

**Prompt:**
```
KYC complete. Build core Profile module.

1. Drizzle schema already exists: profiles, profile_photos, community_zones
   MongoDB Mongoose model: ProfileContent (full profile data)

2. Profile fields to implement:
   Personal: fullName, dob, gender, height, religion, caste, motherTongue, maritalStatus, manglik, gotra
   Education: degree, college, fieldOfStudy, year
   Profession: occupation, employer, incomeRange, workLocation, workingAbroad

3. Safety Mode — contact gating:
   contactHidden: true by default
   unlockedWith: [] array of profile IDs who can see phone/email
   Phone and email NEVER returned in any API response unless profileId is in unlockedWith

4. Profile photos:
   USE_MOCK_SERVICES=true → save to local /tmp/uploads/
   Real: Cloudflare R2 pre-signed URL upload
   Max 6 photos, isPrimary flag, displayOrder

5. Profile completeness calculator (0–100 score)
   Weights: photos 25% · personal 20% · profession 15% · horoscope 15% · preferences 25%

6. Endpoints:
   GET/PUT /api/v1/profiles/me
   POST/DELETE /api/v1/profiles/me/photos
   GET /api/v1/profiles/:id (Safety Mode applied)
   PUT /api/v1/profiles/me/preferences
   POST /api/v1/profiles/me/unlock/:matchId

7. Profile view Server Component in apps/web/

8. Vitest: Safety Mode logic, completeness calculator

Plan first. Wait for approval.
```

---

### Day 8–9: Profile Extended (Family, Lifestyle, Horoscope)

**Prompt:**
```
Profile core done. Add remaining profile sections.

1. Family fields (MongoDB profiles_content):
   fatherOccupation, motherOccupation, siblings[], familyType (JOINT/NUCLEAR/EXTENDED)
   familyValues (TRADITIONAL/MODERATE/LIBERAL), familyStatus

2. Lifestyle + hyper-niche tags:
   diet (VEG/NON_VEG/JAIN/VEGAN/EGGETARIAN)
   smoking, drinking (NEVER/OCCASIONALLY/REGULARLY)
   hobbies[], interests[]
   hyperNicheTags: ['vegetarian', 'career-first', 'spiritual', 'entrepreneur', 
                    'environmentalist', 'government-employee', 'working-abroad']

3. Partner preferences:
   ageRange {min, max}, heightRange {min, max}, incomeRange
   religion[], caste[], location[], manglik preference
   openToInterfaith, openToInterCaste, diet[]

4. Horoscope data:
   rashi (moon sign), nakshatra (birth star index 1–27), dob, tob, pob
   manglik boolean, gotra string
   chartImageKey (R2 key for uploaded kundli image)

5. Community Match Zones:
   community (e.g. Rajput, Brahmin, Jain, Muslim, Christian)
   subCommunity, language preference
   lgbtqProfile boolean — admin-level toggle ONLY, never user-settable

6. Profile edit forms in apps/web/ — multi-step, save per section

Plan first. Wait for approval.
```

---

### Day 10: Profile View Page (UI)

**Prompt:**
```
Profile data complete. Build profile view UI.

Use /ui-component for all components. Smart Shaadi design system:
Primary: #7B2D42 | Gold: #C5A47E | Teal: #0E7C7B | Background: #FEFAF6
Cards: rounded-xl | Font: Playfair Display headings + Inter body

Build these Server Components:
1. ProfileHero — primary photo, name, age, city, verified badge (Teal), completeness bar
2. ProfileDetails — tabbed: Personal · Family · Career · Lifestyle
3. CompatibilityDisplay — Guna Milan score (n/36 in Burgundy), overall score (Teal)
4. SafetyModeBadge — shows "Contact hidden" in Gold until unlocked
5. PartnerPreferences — displayed tastefully, not as a checklist
6. PhotoGallery — grid of up to 6 photos, lightbox on click

All Server Components. No client components unless needed for lightbox.
Mobile-first. Every component: loading state, empty state, 375px works.

Plan first. Wait for approval.
```

---

## WEEK 3 — Matchmaking Core

### Day 11–12: Reciprocal Matching Engine

**Prompt:**
```
Profiles complete. Build the Reciprocal Matching Engine — Smart Shaadi core differentiator.

Bilateral filter is NON-NEGOTIABLE. No exceptions.

1. Hard filter (BOTH directions):
   - Apply A's partner preferences against candidate B's profile
   - Apply B's partner preferences against A's profile
   - If A fails B's filters → remove entirely from A's feed
   - If B fails A's filters → also remove
   Only profiles where BOTH pass surface in the feed.

2. Compatibility scoring (rule-based — Phase 1):
   Demographic alignment (age, location, education): 25 pts
   Lifestyle match (diet, values, hyper-niche tags): 20 pts
   Preference overlap (how well each meets other's stated prefs): 20 pts
   Community/religion alignment: 15 pts
   Profile completeness bonus: 20 pts
   Total: 100 pts

3. Match feed:
   GET /api/v1/matchmaking/feed → top 20, cached Redis 24h key: match_feed:{userId}
   GET /api/v1/matchmaking/search (filter-based, paginated)
   GET /api/v1/matchmaking/score/:profileId (compatibility vs specific profile)

4. Store scores in match_scores table (schema exists)
   One record per pair: profileA UUID < profileB UUID alphabetically

5. Guna Milan: call POST /ai/horoscope/guna if AI service running, else skip
   Store result in match_scores.guna_milan_score

6. Vitest: bilateral filter edge cases (this must be bulletproof)
   Test: user whose prefs A doesn't meet → not in A's feed
   Test: user who meets A's prefs but A doesn't meet theirs → also not in feed

Plan first. Wait for approval.
```

---

### Day 13–15: Guna Milan Calculator (3 Days — Do Not Compress)

**Prompt:**
```
Build Guna Milan in apps/ai-service/routers/horoscope.py
Pure Python deterministic math. NO LLM involved. All 8 Ashtakoot factors.

Factor 1: Varna (max 1 pt) — spiritual compatibility by moon sign caste group
  Lookup table: Brahmin > Kshatriya > Vaishya > Shudra
  Same = 1, higher to lower = 0.5, lower to higher = 0

Factor 2: Vashya (max 2 pts) — control/dominance by Vashya group
  5 groups: Manav, Chatushpad, Jalchar, Vanchar, Keeta
  Same group = 2, one controls other = 1, neutral = 0.5, incompatible = 0

Factor 3: Tara (max 3 pts) — count girl's birth star to boy's, divide by 9, remainder
  Remainder 1,3,5,7 = 1.5 pts each direction (avg)
  Implement bidirectional calculation

Factor 4: Yoni (max 4 pts) — animal pairs from Nakshatra
  27 Nakshatras mapped to 14 animal types
  Same animal = 4, friendly = 3, neutral = 2, enemy = 1, bitter enemy = 0

Factor 5: Graha Maitri (max 5 pts) — moon sign lord friendship
  Planet friendship table (Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn)
  Both lords friends = 5, one friend one neutral = 4, etc.

Factor 6: Gana (max 6 pts) — Deva/Manav/Rakshasa temperament
  Same = 6, Deva+Manav = 5, Manav+Rakshasa = 1, Deva+Rakshasa = 0

Factor 7: Bhakoot (max 7 pts) — moon sign relationship
  2-12, 5-9, 6-8 placements = 0 pts (Bhakoot Dosha)
  1-1, 1-7 etc. per compatibility table

Factor 8: Nadi (max 8 pts) — Adi/Madhya/Antya Nadi
  Same Nadi = 0 (Nadi Dosha — genetic concern)
  Different Nadi = 8

Mangal Dosha: Mars in houses 1,2,4,7,8,12 from Lagna or Moon
  Both Manglik = Dosha cancelled
  One Manglik = mangal_dosha_conflict: true

Endpoint: POST /ai/horoscope/guna
Input:  { profile_a: {rashi, nakshatra, manglik}, profile_b: {rashi, nakshatra, manglik} }
Output: { total_score, max_score: 36, percentage, factors: {each with score/max/notes},
          mangal_dosha_conflict, interpretation, recommendation }

Score interpretation: 0–17 Not recommended | 18–24 Average | 25–31 Good | 32–36 Excellent

Pytest: 100% coverage — all 8 factors independently, same Nakshatra edge case,
both Manglik cancellation, 0/36, 36/36, Bhakoot Dosha, Nadi Dosha

Plan first. Wait for approval.
```

---

## WEEK 4 — Match Requests & Chat

### Day 16–17: Match Requests + Privacy

**Prompt:**
```
Matching engine done. Build Match Requests and Privacy system.

1. Request lifecycle: PENDING → ACCEPTED | DECLINED | WITHDRAWN | BLOCKED
   POST /api/v1/matchmaking/requests (send)
   PUT  /api/v1/matchmaking/requests/:id (accept/decline)
   DELETE /api/v1/matchmaking/requests/:id (withdraw)

2. Block and report:
   POST /api/v1/matchmaking/block/:profileId
   POST /api/v1/matchmaking/report/:profileId (with reason, goes to admin queue)
   Blocked user never appears in feed again — both directions

3. Contact visibility:
   When match accepted → contact still hidden (Safety Mode)
   POST /api/v1/profiles/me/unlock/:matchId — only then phone/email shared
   Both parties must independently unlock for bidirectional contact share

4. Notifications on all state changes via Bull queue:
   Match request received → push to receiver
   Match accepted → push to both
   Contact unlocked → push to both

5. Request list views:
   GET /api/v1/matchmaking/requests/received (incoming, paginated)
   GET /api/v1/matchmaking/requests/sent (outgoing, paginated)

6. Match request UI cards in apps/web — use /ui-component

7. Vitest: all request state transitions, contact visibility logic

Plan first. Wait for approval.
```

---

### Day 18–20: Real-Time Chat

**Prompt:**
```
Match requests done. Build real-time chat with Socket.io.

Server: apps/api — namespace /chat, rooms by matchRequestId
Client proxy: apps/web/lib/socket/chat.ts

1. Socket.io server setup:
   Redis adapter (ioredis) for multi-instance safety
   JWT authentication on handshake — reject unauthenticated connections
   Room per accepted match pair: room = matchRequestId

2. Events client→server:
   join_room(matchRequestId)
   send_message({ content, type: 'TEXT'|'PHOTO', photoKey? })
   mark_read(messageId)
   typing_start() / typing_stop()

3. Events server→client:
   message_received({ _id, senderId, content, sentAt, readAt })
   messages_read({ by: userId, upTo: messageId })
   user_typing({ profileId, isTyping })
   match_status_changed (match accepted/blocked notification)

4. Message persistence → MongoDB chats collection
   Structure: { participants[], matchRequestId, messages[], lastMessage }
   Messages: { _id, senderId, content, contentHi, contentEn, type, photoKey, sentAt, readAt }

5. Photo sharing:
   USE_MOCK_SERVICES=true → save locally
   Real: R2 pre-signed URL upload, store key in message

6. Hindi-English translation:
   POST /ai/chat/translate (mock returns original text)
   Store both contentHi and contentEn per message
   User toggles language preference

7. Chat UI in apps/web — use /ui-component
   MessageBubble (own vs other, photo support), TranslationToggle, TypingIndicator

8. Vitest: message persistence, room joining, auth rejection

Plan first. Wait for approval.
```

---

## WEEK 5 — Vendors, Bookings, Payments, Dashboards

### Day 21–22: Vendor Discovery

**Prompt:**
```
Chat done. Build Vendor Discovery system.

1. Vendor listings:
   GET /api/v1/vendors (filter: category, city, eventType, rating, priceRange)
   GET /api/v1/vendors/:id (full profile + portfolio)
   GET /api/v1/vendors/:id/availability (available dates)
   Pagination: page + limit, sorted by rating desc by default

2. Vendor portfolio (MongoDB vendor_portfolios):
   about, tagline, portfolio[], packages[], eventTypes[], faqs[]
   All 17 vendor categories from schema enum

3. Vendor registration (VENDOR role only):
   POST /api/v1/vendors (create listing)
   PUT /api/v1/vendors/:id (update)
   POST /api/v1/vendors/:id/services (add package)

4. VendorCard UI component — use /ui-component
   Design: Teal rating stars, Gold border on featured, Burgundy category badge
   Shows: primary photo, name, category, city, rating, price range, verified badge
   CTA: "View Profile" + "Book Now" (both Teal buttons)

5. Vendor portfolio page — photo gallery, packages grid, availability calendar

6. Search: fuzzy name search, multi-filter, location radius

Plan first. Wait for approval.
```

---

### Day 23–24: Booking System

**Prompt:**
```
Vendor discovery done. Build Booking state machine.

State machine: PENDING → CONFIRMED → COMPLETED | CANCELLED | DISPUTED

1. Booking creation:
   POST /api/v1/bookings
   Check vendor availability before confirming (no double-booking on same date)
   ceremonyType from enum: WEDDING | HALDI | MEHNDI | SANGEET | CORPORATE | FESTIVAL | etc.

2. State transitions:
   PUT /api/v1/bookings/:id/confirm (VENDOR only — PENDING → CONFIRMED)
   PUT /api/v1/bookings/:id/complete (customer — CONFIRMED → COMPLETED, triggers escrow)
   PUT /api/v1/bookings/:id/cancel (either party — any state → CANCELLED)

3. Cancellation policy:
   Before confirmed → full refund (mock)
   After confirmed → partial refund logic (configurable per vendor)

4. Invoice generation on confirmation:
   USE_MOCK_SERVICES=true → log "Invoice generated"
   Real: PDF via pdfkit, stored in R2, emailed via SES

5. Booking views:
   GET /api/v1/bookings (customer — my bookings)
   GET /api/v1/vendor/bookings (vendor — incoming bookings, calendar view)
   GET /api/v1/bookings/:id (detail)

6. Booking flow UI in apps/web — use /ui-component
   BookingSteps (select date → confirm details → pay), EscrowExplainer

7. Vitest: all state transitions, double-booking prevention, cancellation logic

Plan first. Wait for approval.
```

---

### Day 25: Payments + All 3 Dashboards + Phase 1 Launch

**Prompt:**
```
Booking system done. Final Phase 1 day — payments, dashboards, QA, deploy.

MORNING — Payments:
1. Razorpay mock: USE_MOCK_SERVICES=true → always returns payment success
   Real: Razorpay order creation + payment capture
2. Webhook handler: POST /api/v1/payments/webhook
   Verify Razorpay signature (even in mock mode — test the verification logic)
   Update payment status, trigger next actions via Bull queue
3. Invoice PDF: pdfkit (mock = console.log, real = PDF + R2 + SES)
4. Refund: POST /api/v1/payments/refund/:paymentId (mock returns success)
5. 100% test coverage on webhook handler — non-negotiable

AFTERNOON — Three Dashboards:
Customer dashboard:
  - Active matches count, unread messages
  - Upcoming bookings (next 3)
  - Profile completeness bar + suggestions
  - Recent notifications

Vendor dashboard:
  - Today's bookings calendar
  - Monthly revenue summary
  - Pending confirmations (action required)
  - Review requests

Admin dashboard:
  - KYC queue (pending verifications count)
  - Vendor approval queue
  - Open complaints
  - Platform metrics (total users, bookings today, revenue)

EVENING — QA + Deploy:
Run: pnpm type-check && pnpm lint && pnpm test && pnpm e2e
Fix all failures. Then:
- Deploy to Railway (API + AI service)
- Deploy to Vercel (web app)
- Verify production URL is live
- Update ROADMAP.md Phase 1 all complete
- Update CLAUDE.md current status to Phase 2 Week 6
- git commit "feat: Phase 1 complete — platform live 🚀"

Plan first. Wait for approval.
```

---

# PHASE 2 — MONTH 2 (Weeks 6–9)

---

## WEEK 6: Wedding Planning Core

### Day 1–2: Wedding Plan + Budget Tracker

**Prompt:**
```
Phase 1 complete. Starting Phase 2.

Build Wedding Planning Suite core.

1. Wedding plan creation:
   POST /api/v1/weddings
   Drizzle: weddings table (schema exists)
   MongoDB: wedding_plans collection (theme, budget, ceremonies, checklist)

2. Budget tracker:
   Categories: Venue · Catering · Decoration · Photography · Clothing · Makeup · Music · Transport · Other
   Per category: allocated amount, spent amount, vendor booking links
   Real-time total calculation

3. Kanban task board:
   Auto-generate checklist from wedding date (90 days of tasks backward)
   Statuses: TODO | IN_PROGRESS | DONE
   Priority: LOW | MEDIUM | HIGH
   Assign to family members

4. Pre-wedding ceremonies: Haldi, Mehndi, Sangeet
   Each has own date, venue, vendor assignments, task list

5. Muhurat date selector:
   Given rashi + nakshatra → suggest 3 auspicious dates
   POST /ai/horoscope/muhurat (mock returns 3 sample dates 2–3 months ahead)

6. Wedding plan page UI — use /ui-component
   BudgetDonut (Teal filled, Gold border), TaskKanban, CeremonyTimeline

7. Vitest: task auto-generation from date, budget calculation

Plan first. Wait for approval.
```

---

### Day 3–5: Family Collaboration + Guest Management

**Prompt:**
```
Wedding plan core done. Build Family collaboration and Guest management.

FAMILY COLLABORATION:
1. Invite family members by phone:
   POST /api/v1/weddings/:id/members
   Roles: VIEWER (read) | EDITOR (read+write tasks) | OWNER (full access)
   wedding_members table (schema exists)

2. Shared task visibility — family can see and update tasks per their role
3. Activity feed per wedding plan — who did what

GUEST MANAGEMENT:
4. Guest list:
   Manual entry or CSV/Excel import
   Fields: name, phone, email, relationship, side (BRIDE/GROOM/BOTH),
           rsvpStatus, mealPreference (VEG/NON_VEG/JAIN/VEGAN), roomNumber, plusOnes

5. RSVP tracking:
   Public RSVP link (no login): PUT /api/v1/weddings/:id/guests/:guestId/rsvp
   Status: PENDING | YES | NO | MAYBE
   Stats: total invited, confirmed, pending, declined, meal counts

6. Digital invitation builder:
   Template selection + couple photo upload to R2
   Delivery: email via SES (mock) + SMS via MSG91 (mock)
   POST /api/v1/weddings/:id/invitations/send

7. Room allocation for outstation guests

8. Guest list UI — GuestRow, RSVPBadge, MealPrefTag, stats summary

Plan first. Wait for approval.
```

---

## WEEK 7–8: Communication + Payments

### Day 6–7: Video Calls + Meeting Scheduler

**Prompt:**
```
Guests done. Build video calls and meeting scheduler.

VIDEO CALLS (Daily.co — mock if no API key):
1. Create room per match pair on first video call:
   POST /api/v1/video/room/:matchRequestId
   USE_MOCK_SERVICES=true → return { url: "https://vivah.daily.co/test-room" }
   Real: Daily.co API room creation

2. In-platform video page in apps/web/
   Shows Daily.co call embedded via iframe
   No personal number shared — users still anonymous at this point

3. AI conversation prompts overlay during call (Phase 3 — stub endpoint now)

MEETING SCHEDULER:
4. Propose meeting slot: POST /api/v1/meetings/propose
5. Accept/decline: PUT /api/v1/meetings/:id/respond
6. Bull queue: schedule reminder 1h before meeting via push notification
7. Meeting history in chat sidebar

Plan first. Wait for approval.
```

---

### Day 8–10: Escrow + Rentals + E-Commerce

**Prompt:**
```
Video calls done. Build Escrow, Rental, and E-Commerce modules.

ESCROW PAYMENT SYSTEM:
1. On booking complete trigger (customer clicks "Mark Event Complete"):
   escrow_accounts.status → HELD already from booking payment
   Start Bull delayed job: release after 48 hours if no dispute

2. Dispute window:
   PUT /api/v1/bookings/:id/dispute (must be within 48h of completion)
   Creates dispute record, pauses escrow release, alerts admin

3. Admin resolution:
   PUT /api/v1/admin/disputes/:id/resolve (release full | partial | refund)

4. Auto-release after 48h:
   Bull queue: escrow-release job with 48h delay
   Razorpay Transfer to vendor (mock → log)

5. All state changes → audit_logs table (immutable, hash-chained)

6. 100% Vitest coverage on all escrow state transitions

RENTAL MODULE:
7. Rental catalogue: decor, costumes, AV equipment, furniture
   Date-range booking with quantity, deposit management
   Return tracking: RETURNED | DAMAGED | OVERDUE states

E-COMMERCE STORE:
8. Product listings: gifts, trousseau, ethnic wear, pooja items, invitation cards, decor
   Vendor creates product → admin approves → live on marketplace

9. Shopping cart + checkout (Razorpay mock)

10. Order flow: PLACED → CONFIRMED → SHIPPED → DELIVERED
    Vendor marks shipped (adds tracking number), marks delivered

11. Vendor product dashboard: inventory, orders, revenue by product

Plan first. Wait for approval.
```

---

## WEEK 9: Multi-Event + Push + Phase 2 QA

**Prompt:**
```
Escrow and e-commerce done. Final Phase 2 week.

MULTI-EVENT FOUNDATION:
1. Extend booking system to support non-wedding event types:
   CORPORATE | FESTIVAL | COMMUNITY | GOVERNMENT | SCHOOL | BIRTHDAY | ANNIVERSARY
   Vendor can opt in to event types in their profile (vendor_event_types table)

2. Event type filter in vendor search

FIREBASE PUSH NOTIFICATIONS:
3. All key events → push via Firebase FCM + Bull queue:
   New match request, match accepted, new message, booking confirmed,
   RSVP received, task due in 24h, payment received, escrow released

4. Notification preference management per user

5. In-app notification feed: GET /api/v1/notifications

PHASE 2 QA:
6. Run: pnpm type-check && pnpm lint && pnpm test && pnpm e2e
7. Security check: phone/email masked in all responses? escrow fully tested?
8. Mobile check: every new screen works at 375px?
9. Deploy Phase 2 to production
10. Update ROADMAP.md, CLAUDE.md, commit "feat: Phase 2 complete 🚀"

Plan first. Wait for approval.
```

---

# PHASE 3 — MONTH 3, WEEKS 10–11

---

## WEEK 10: AI Features (Days 1–5)

### Day 1–2: AI Service + Conversation Coach + Emotional Score

**Prompt (use /ai-module):**
```
Phase 2 complete. Starting Phase 3 AI Intelligence Layer.

All AI work is in apps/ai-service/ (Python/FastAPI).
ALL LLM calls via Helicone proxy. Never direct from frontend.
Rule-based first, ML transitions in as data grows.

BUILD in order:

1. FastAPI AI service: ensure it's deployed on Railway
   Health check: GET /health → { status: "ok", phase: 3 }
   Internal auth: x-internal-key header (AI_SERVICE_INTERNAL_KEY)

2. AI Conversation Coach (apps/ai-service/routers/conversation.py):
   Input: profile_a interests/hobbies, profile_b interests/hobbies, last_message (optional)
   Processing: extract shared interests → generate 3 culturally appropriate ice-breakers
   Model: claude-haiku-4-5 via Helicone (cheapest, fast enough)
   Prompt file: prompts/conversation-coach-v1.md (versioned)
   Cache in Redis: 1h TTL per pair
   Output: { suggestions: [{ text, reason }] }
   POST /ai/conversation/coach

3. Emotional Compatibility Score (apps/ai-service/routers/conversation.py):
   Input: last 20 messages from chat (from MongoDB)
   Processing rule-based Phase 1:
     Response time pattern → enthusiasm_score
     Message length trend → engagement_score
     Sentiment analysis (TextBlob) → sentiment_score
     Questions asked → curiosity_score
   Output: { score: 0-100, trend: 'improving'|'stable'|'declining', breakdown: {...} }
   POST /ai/conversation/emotion
   Display in apps/web chat header — Teal colour for positive, Burgundy for concern

4. TypeScript proxy in apps/web/lib/ai/conversation.ts
5. Langfuse trace on every LLM call
6. Pytest: coach suggestions, emotion scoring rules

Plan first. Wait for approval.
```

---

### Day 3–5: Profile Optimizer + Marriage Readiness + Family Compatibility

**Prompt:**
```
Conversation features done. Build remaining matchmaking AI features.

AI Profile Optimizer (apps/ai-service/routers/profile.py):
1. Input: profile completeness score, bio text, photo count, photo quality (mock = 99)
   Real photo quality: AWS Rekognition face detection confidence
2. Output: specific actionable suggestions
   Examples: "Add a full-face primary photo — 3x more responses"
             "Your bio doesn't mention career — add 1 sentence"
             "Upload 2 more photos to reach optimal visibility"
3. POST /ai/profile/optimize
4. Shown as a dismissible card on profile edit page — Gold colour scheme

Marriage Readiness Score (apps/ai-service/routers/profile.py):
5. Composite indicator (rule-based):
   Profile completeness: 30% weight
   Communication depth (from chat data): 25% weight
   Life goal clarity (from profile fields): 25% weight
   Engagement consistency (login frequency, response rate): 20% weight
6. Output: { score: 0-100, breakdown: {...}, display_allowed: bool }
7. User-controlled: they choose whether to show it on their profile
8. POST /ai/profile/readiness
9. Display in Burgundy on profile if user enables it

Family Compatibility Mode (apps/ai-service/routers/matching.py):
10. Input: profile_a family data + profile_b family data
    Factors: familyType match, familyValues alignment, socioeconomic level, location proximity
11. Output: { family_score: 0-100, individual_score: 0-100, combined_score: 0-100, notes: [] }
12. POST /ai/match/family-score
13. Shown as split view on match card: "You: 78 · Family: 82 · Combined: 80"

All: Pytest coverage, Langfuse traces, TypeScript proxy, error handling

Plan first. Wait for approval.
```

---

## WEEK 11: Reputation + Behaviour + Churn + Vendor Engine

**Prompt:**
```
Core AI features done. Final Phase 3 week.

Reputation Score:
1. Rule-based trust indicator per user
   Response rate (accepted matches / total received): 30%
   Message response time (avg hours to reply): 20%
   Ghosting rate (accepted matches with zero messages): 30%
   Profile honesty (KYC verified + complete): 20%
2. Recalculated weekly via Bull queue job
3. Display on profile as trust indicator — Gold star rating

Divorcee & Widow Support Mode:
4. Additional profile flag: maritalStatus = DIVORCED | WIDOWED | SEPARATED
   Dedicated matching filters (only shows in search if user opts in)
   Private — never surfaced without explicit user consent
   Confidence-building onboarding checklist in profile

Behaviour-Based Matching signal layer:
5. Passive signal collection (no user action needed):
   Profile view duration → store in Redis, aggregate daily
   Browse patterns → which profiles they revisit
   Message frequency → engagement with each match
6. Signal weights added to existing compatibility scorer
   Signals collected since Phase 1 launch — use them now

Predictive Churn Detection:
7. Churn signals: days since login, declining response rate, no new matches engaged
8. Scikit-learn Logistic Regression (train on synthetic data → retrain at 500+ users)
9. Risk levels: LOW (no action) | MEDIUM (digest email) | HIGH (new curated match push)
10. Bull queue: check all users daily at 3am, trigger win-back for HIGH risk

Matrimony AI Assistant (stub for now):
11. POST /ai/assistant/chat — conversational guide
    "Find me matches who love trekking in Maharashtra"
    Returns structured search params → calls match feed API
    Full implementation Phase 4

Vendor Utilization Engine Foundation:
12. Track vendor_event_types (already in schema)
    Begin routing: vendors with CORPORATE opt-in appear in corporate event searches
    Vendor dashboard: show "You're eligible for X upcoming events" section

Phase 3 QA + Deploy:
pnpm type-check && pnpm test → fix all
Deploy → update ROADMAP.md → commit "feat: Phase 3 complete 🚀"

Plan first. Wait for approval.
```

---

# PHASE 4 — MONTH 3, WEEKS 12–13

---

## WEEK 12: Revenue + Language (Days 1–5)

**Prompt:**
```
Phase 3 complete. Phase 4 — Scale and Market Readiness.

SUBSCRIPTION TIERS:
1. Three tiers:
   FREE: 5 match views/day, basic chat, no AI features
   STANDARD: unlimited matches, AI Conversation Coach, priority visibility
   PREMIUM: all features + Verified badge + dedicated AI recommendations + no ads

2. Razorpay Subscriptions (mock):
   POST /api/v1/subscriptions/create
   POST /api/v1/subscriptions/webhook (handle subscription events)
   Subscription status in users table: tier, renewsAt, cancelledAt

3. Feature gating middleware: checkSubscription(feature: SubscriptionFeature)
   Applied to: AI Coach routes, priority match feed, profile visibility boost

4. Upgrade flow in apps/web — pricing cards with Teal CTA buttons

VENDOR LEAD GENERATION FEE:
5. Vendors pay per qualified inquiry (customer contacts them)
   Fee: configurable per category (e.g. Photography = ₹50/inquiry)
   Charged via Razorpay (mock) on contact unlock
   Vendor dashboard: inquiry credits, purchased vs used

REFERRAL PROGRAMME:
6. Unique referral code per user on registration
   Reward trigger: new user registers via referral link AND completes profile
   Reward: 1 week STANDARD tier free for referrer
   Referral dashboard: codes, clicks, conversions

HINDI LANGUAGE SUPPORT:
7. next-intl i18n framework
   Full Hindi translation for all user-facing text
   Language toggle in user settings (EN | हिं)
   i18n-ready for Tamil, Gujarati, Punjabi, Marathi without rebuild

Plan first. Wait for approval.
```

---

## WEEK 13: SEO + Security + Final Launch

**Prompt:**
```
Revenue and language done. Final Phase 4 week — SEO, hardening, launch.

AUTO-SEO ENGINE:
1. Dynamic routes in apps/web: /[community]-matrimony-[city]
   Examples: /brahmin-matrimony-mumbai /rajput-matrimony-jaipur /jain-matrimony-surat
2. LLM generates page content (claude-haiku — cheapest):
   Prompt in prompts/auto-seo-v1.md
   Content: heading, 3 paragraphs, FAQ section, local vendor highlights
3. JSON-LD structured data for Google rich results
4. Auto-sitemap.xml: updates when new pages generated
5. Generate first 100 community×city combinations on deploy

GDPR + COMPLIANCE:
6. Consent management: user must explicitly accept data processing on registration
7. Right to deletion: DELETE /api/v1/users/me/data → anonymise all data
8. Data portability: GET /api/v1/users/me/export → JSON download of all their data

ANALYTICS DASHBOARD (Admin):
9. PostHog integration — funnel: register → verify → profile → match → chat → book
10. Revenue attribution by stream (subscriptions vs bookings vs lead gen vs referral)
11. Vendor utilization rate by city
12. Churn risk distribution chart

LGBTQ+ TOGGLE:
13. Admin can enable/disable LGBTQ+ matching per city/region
    Profile flag: lgbtqProfile (only set by admin, not user)
    When enabled: matching includes LGBTQ+ profiles

FULL SECURITY AUDIT:
14. Check all endpoints have authenticate() middleware
15. Verify phone/email never in responses (audit 10 random endpoints)
16. Rate limits applied to OTP, match requests, chat
17. Razorpay webhook signature verification confirmed
18. Load test with k6: 500 concurrent users, match feed < 200ms

PRODUCTION DEPLOY:
19. Set all env vars in Railway + Vercel dashboards
20. USE_MOCK_SERVICES=false ONLY after real credentials arrive
21. Run smoke test on production
22. Update ROADMAP.md all Phase 4 tasks complete
23. CLAUDE.md status → Phase 5 pending client confirmation
24. git commit "feat: Phase 4 complete — core platform market-ready 🚀"

Plan first. Wait for approval.
```

---

# EXPANSION PHASES 5–8

## Phase 5 Kickoff Prompt (Month 4)

```
Core platform (Phases 1–4) is live and earning revenue.
Client has confirmed expansion. Starting Phase 5.

Phase 5 goal: Vendor Utilization Engine + Calendar Intelligence + B2B

Build in order:
Week 1: Full Vendor Utilization Engine — automatic off-season event routing
Week 2: Vendor Gap Detection + Calendar Intelligence (muhurat + government + festival)
Week 3: Dynamic Pricing full implementation (muhurat premium + off-season discounts)
Week 4: Documentation & Compliance + B2B Self-Serve + Phase 5 deploy

Today I'm starting: [specify first module]

Read CLAUDE.md and ROADMAP.md first.
Plan before coding.
```

## Phase 6 Kickoff Prompt (Month 5)

```
Phase 5 live. Starting Phase 6 — Financial Services + Marketing + Multi-city.

Real credentials should be arriving:
- If Razorpay is live: set USE_MOCK_SERVICES=false, test end-to-end
- If DigiLocker is live: swap KYC mock, test full flow
- If MSG91 is live: swap OTP mock, test with real phone

Phase 6 modules:
- NBFC partner API integration (loan referral — no lending risk)
- Wedding insurance referral at booking confirmation
- Auto-Marketing Engine (n8n + Claude API content pipeline)
- Multi-city vendor network with city-specific admin
- WhatsApp Business API (Meta approval: apply NOW if not done)

Today I'm starting: [specify]
```

## Phase 7 Kickoff Prompt (Month 6 first half)

```
Phase 6 live. Starting Phase 7 — Mobile App + NRI.

CRITICAL before coding:
- Apple Developer Program ($99/year) — must be active NOW
- Google Play Console ($25 one-time) — must be active NOW
- WhatsApp Business API — must be approved before this phase

Mobile stack: React Native 0.78 + Expo SDK 55 + Expo Router v4 + NativeWind
90% code reuse from web (shared packages/types and packages/schemas)

Modules:
Week 9: React Native scaffold + auth + core screens + EAS Build CI
Week 10: Match feed + chat + bookings on mobile (feature parity)
Week 11: NRI matching + Virtual Date System + App Store submissions

Today I'm starting: [specify]
```

---

# WEEKLY REVIEW PROMPTS

## Every Friday — Week-End Review

```
End of week [N] review for Smart Shaadi.

Run quality gate:
pnpm type-check → must be zero errors
pnpm lint → must be zero errors
pnpm test → all passing
pnpm e2e → all passing

Then check:
1. All this week's ROADMAP.md tasks — which are done, which are behind?
2. Any architecture violations introduced this week? Run the audit prompt.
3. Any new blockers to document?
4. What's the realistic target for next week?

Update ROADMAP.md, update CLAUDE.md current status.
git add -A && git commit -m "chore: week [N] complete — [brief summary]"
Push to GitHub. Verify Railway + Vercel deploys succeeded.
```

## Architecture Audit (Run Weekly)

```
Audit recent code for Smart Shaadi architecture violations.

Check every new file added this week for:
1. LLM calls outside apps/ai-service/ or apps/web/lib/ai/?
2. DB queries missing userId filter?
3. Next.js mutations using API routes instead of Server Actions?
4. TypeScript `any` usage?
5. Phone/email in API responses without masking?
6. File uploads going through API instead of R2 pre-signed URLs?
7. Session data in app memory instead of Redis?
8. Notifications sent synchronously in request handlers?
9. Sensitive data (Aadhaar, raw KYC) being stored?

Files changed this week: [list from git diff --name-only HEAD~7]
List every violation with file, approximate line, and fix.
```

## Indian Market Readiness Check (Run Each Phase)

```
Review Phase [N] for Indian market readiness before deploying.

Check:
1. Hindi — is i18n wiring in place for all new text?
2. Phone numbers — accepting both +91 and 10-digit local format?
3. Payments — UPI flow prominent? (preferred by 70%+ of Indian users)
4. KYC — Aadhaar as primary, not passport?
5. Names — no mandatory middle name, supporting single-word names?
6. Addresses — Indian format (pincode, state, city)?
7. Dates — DD/MM/YYYY display format?
8. Currency — ₹ symbol, Indian number format (1,00,000 not 100,000)?
9. Community fields — sensitive handling, no forced disclosure?
10. 3G performance — pages load under 3 seconds on slow connection?

For each: YES (passes) | NO (needs fix) | N/A (not applicable this phase)
```

---

# MOCK-TO-REAL SWAP PROMPTS (When Registrations Arrive)

## MSG91 OTP Swap

```
MSG91 DLT registration is approved. Swap mock OTP to real.

Files to update:
1. apps/api/services/otp.service.ts — remove mock branch, implement real MSG91 call
2. apps/api/.env — add real MSG91_API_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID
3. Set USE_MOCK_SERVICES=false in production .env (Railway dashboard)

Verify:
Send OTP to my real phone number: +91[your number]
Confirm it arrives within 30 seconds

Flag any edge cases that work in mock but might fail with real API
(e.g. DLT template variable format, transactional vs promotional classification).
```

## Razorpay Swap

```
Razorpay merchant account is approved. Swap mock payments to real.

Files to update:
1. apps/api/services/payment.service.ts — real Razorpay order creation + capture
2. apps/api/modules/payments/payments.router.ts — webhook signature verification
3. apps/api/.env — add real RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
4. apps/web/.env.local — add real NEXT_PUBLIC_RAZORPAY_KEY_ID

Test sequence:
1. Create a ₹1 test booking end-to-end
2. Pay via UPI test credentials
3. Confirm webhook received and payment status updated
4. Test refund flow

100% test coverage on webhook handler — run now if not already at 100%.
```

## Digilocker KYC Swap

```
Digilocker API is approved. Swap mock KYC to real.

Files to update:
1. apps/api/services/kyc.service.ts — real Digilocker OAuth flow
2. apps/api/.env — add DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET
3. Verify DIGILOCKER_REDIRECT_URI matches what's registered with Digilocker

Test sequence:
1. Initiate KYC flow — should redirect to Digilocker consent page
2. Complete consent with test Aadhaar
3. Verify callback received and verification_status → VERIFIED
4. Confirm Aadhaar number is NOT stored anywhere in our database

Show me the updated service file and the test sequence output.
```
