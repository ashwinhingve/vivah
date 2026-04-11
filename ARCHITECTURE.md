# Smart Shaadi — System Architecture

---

## Architecture Pattern

**Modular Monolith → Selective Microservices**

The backend starts as a modular monolith (Node.js API) with one extracted service from day one: the Python AI service. This gives microservice-readiness without microservice complexity during the build phase. Additional services are extracted only when load or scale demands it.

```
┌────────────────────────────────────────────────────────────┐
│                    CloudFront / Cloudflare CDN              │
└───────────────────────────┬────────────────────────────────┘
                            │
           ┌────────────────▼────────────────┐
           │      Vercel — Next.js 15 Web     │
           │  App Router · RSC · Server Acts  │
           └────────────────┬────────────────┘
                            │  REST + WebSocket
           ┌────────────────▼────────────────┐
           │     Railway — Node.js API        │
           │  Express · TypeScript · Drizzle  │
           └────┬──────────────┬─────────────┘
                │              │
    ┌───────────▼──┐  ┌────────▼──────────────┐
    │ Railway —    │  │  Railway — FastAPI      │
    │ FastAPI AI   │  │  Not separate yet —     │
    │ Service      │  │  same Railway project   │
    │ Python 3.11  │  └───────────────────────┘
    └───────┬──────┘
            │
┌───────────▼──────────────────────────────────────────┐
│                     Data Layer                        │
│  PostgreSQL (Railway) │ MongoDB Atlas │ Redis (Railway)│
└───────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────┐
│                  External Services                    │
│  Cloudflare R2 │ AWS SES │ MSG91 │ Razorpay │ Firebase│
│  Digilocker   │ Daily.co │ Helicone │ Sentry │ PostHog│
└───────────────────────────────────────────────────────┘
```

---

## Layer-by-Layer Breakdown

### Frontend — `apps/web/`

```
Next.js 15 App Router
├── app/
│   ├── (auth)/          → Login, register, OTP verification
│   ├── (matchmaking)/   → Match feed, profile view, compatibility
│   ├── (chat)/          → Real-time messaging, video calls
│   ├── (wedding)/       → Wedding planning, guests, tasks, budget
│   ├── (vendor)/        → Vendor discovery, booking, portfolio
│   ├── (dashboard)/     → Customer, vendor, admin dashboards
│   └── api/             → Only webhook handlers (Razorpay, Digilocker)
├── components/
│   ├── ui/              → shadcn/ui base components
│   ├── matchmaking/     → Match cards, score display, filters
│   ├── chat/            → Message bubbles, video call overlay
│   ├── wedding/         → Budget charts, task board, guest list
│   └── vendor/          → Portfolio cards, booking flow
└── lib/
    ├── ai/              → LLM call proxy (routes to AI service)
    ├── db/              → Drizzle query helpers (PostgreSQL)
    └── auth/            → Better Auth client helpers
```

**Server Components** handle all data fetching (profile pages, vendor listings, match feed). **Client Components** handle interactivity (chat, video, booking forms). **Server Actions** handle all mutations — no dedicated API routes in Next.js.

---

### Core API — `apps/api/`

```
apps/api/
├── modules/
│   ├── auth/            → OTP, JWT, session management
│   ├── profiles/        → Profile CRUD, photos, preferences
│   ├── matchmaking/     → Reciprocal matching, Guna Milan, match feed
│   ├── chat/            → Socket.io rooms, message persistence
│   ├── weddings/        → Wedding plan, tasks, timeline, budget
│   ├── vendors/         → Listings, availability, portfolio
│   ├── bookings/        → Booking state machine, escrow triggers
│   ├── payments/        → Razorpay integration, webhooks, escrow
│   ├── guests/          → Guest lists, RSVPs, invitations
│   ├── notifications/   → Bull queue, push, SMS, email dispatch
│   └── admin/           → Platform management, vendor approval
├── shared/
│   ├── middleware/      → auth(), authorize(roles[]), rateLimit()
│   ├── guards/          → Input validation, Zod schemas
│   └── utils/           → Response envelope, error classes
└── infrastructure/
    ├── redis/           → Bull queue setup, pub/sub
    ├── socket/          → Socket.io server, room management
    └── db/              → Drizzle client, connection pool
```

**Standard API Response Envelope:**
```typescript
{
  success: boolean
  data: T | null
  error: { code: string; message: string; statusCode: number } | null
  meta: { page?: number; total?: number; limit?: number } | null
}
```

---

### AI Service — `apps/ai-service/`

```
apps/ai-service/
├── routers/
│   ├── matching.py      → Compatibility scoring, match recommendations
│   ├── horoscope.py     → Guna Milan calculator (all 8 Ashtakoot factors)
│   ├── conversation.py  → AI Conversation Coach, Emotional Score
│   ├── profile.py       → Profile Optimizer, Marriage Readiness Score
│   ├── churn.py         → Predictive Churn Detection
│   ├── fraud.py         → Deepfake detection proxy, payment anomaly
│   └── vendor.py        → Vendor recommendation, utilization routing
├── models/
│   ├── compatibility/   → Scikit-learn + sentence-transformer models
│   ├── churn/           → Logistic regression churn classifier
│   └── fraud/           → Isolation Forest anomaly detector
├── schemas/             → Pydantic request/response schemas
├── services/            → Business logic (LLM calls via Helicone)
└── prompts/             → Python-side prompt templates
```

**AI Service Endpoints:**
```
POST /ai/match/score           → Compatibility score between two profiles
POST /ai/match/recommend       → Top-N daily match suggestions for a user
POST /ai/horoscope/guna        → Ashtakoot Guna Milan calculation
POST /ai/conversation/coach    → In-chat ice-breaker suggestions
POST /ai/conversation/emotion  → Sentiment/emotional compatibility score
POST /ai/profile/optimize      → Photo and bio improvement suggestions
POST /ai/profile/readiness     → Marriage Readiness Score
POST /ai/churn/predict         → Churn risk score for a user
POST /ai/fraud/profile         → Profile fraud flags
POST /ai/vendor/recommend      → Vendor suggestions for a wedding
POST /ai/vendor/utilization    → Off-season event routing for vendor
```

---

## Database Architecture

### PostgreSQL — Relational Core (via Drizzle ORM)

All transactional, financial, and relational data. ACID compliance is critical here.

```sql
-- Authentication & Users
users              (id, phone, email, role, status, verified_at)
sessions           (id, user_id, token_hash, device, expires_at)
otp_verifications  (id, phone, otp_hash, purpose, expires_at)

-- Profiles (metadata — full content in MongoDB)
profiles           (id, user_id, mongo_id, verification_status, premium_tier)
profile_photos     (id, profile_id, r2_key, is_primary, order)
community_zones    (id, profile_id, community, sub_community, language)

-- Matchmaking
match_requests     (id, sender_id, receiver_id, status, created_at)
match_scores       (id, profile_a, profile_b, score, breakdown_json, computed_at)
blocked_users      (id, blocker_id, blocked_id)

-- Vendors
vendors            (id, user_id, business_name, category, city, verified, rating)
vendor_services    (id, vendor_id, name, price_from, price_to, unit)
vendor_events      (id, vendor_id, event_type, available)   -- utilization engine

-- Bookings
bookings           (id, customer_id, vendor_id, service_id, event_date, status, total)
booking_items      (id, booking_id, item_type, unit_price, quantity)

-- Weddings
weddings           (id, couple_profile_id, date, venue, budget_total, status)
wedding_tasks      (id, wedding_id, title, due_date, status, assigned_to, priority)
wedding_vendors    (id, wedding_id, vendor_id, booking_id, ceremony_type)
ceremonies         (id, wedding_id, type, date, venue)   -- Haldi, Mehndi, Sangeet

-- Payments & Escrow
payments           (id, booking_id, amount, method, status, razorpay_order_id)
escrow_accounts    (id, wedding_id, total_held, released, created_at)
payment_splits     (id, escrow_id, vendor_id, amount, status)
audit_logs         (id, event_type, entity_id, hash, prev_hash, created_at)  -- immutable

-- Guests
guest_lists        (id, wedding_id, created_by)
guests             (id, guest_list_id, name, phone, rsvp_status, meal_pref, room_id)
invitations        (id, guest_id, sent_at, channel, opened_at)

-- Rentals & Marketplace
rental_items       (id, vendor_id, name, category, price_per_day, deposit)
rental_bookings    (id, rental_item_id, customer_id, from_date, to_date, status)
products           (id, vendor_id, name, price, stock_qty, status)
orders             (id, customer_id, status, total)
order_items        (id, order_id, product_id, qty, unit_price)

-- Notifications
notifications      (id, user_id, type, title, body, read, created_at)
```

### MongoDB — Flexible Content (via Mongoose)

Schema-flexible content: profiles, wedding plans, chat, vendor portfolios.

```javascript
// profiles_content — full profile data
{
  userId: String,          // references PostgreSQL users.id
  personal: { fullName, dob, gender, height, religion, caste, manglik, gotra },
  education: { degree, college, field, year },
  profession: { occupation, employer, income, workLocation },
  family: { father, mother, siblings[], familyType, familyValues },
  location: { city, state, country, coordinates },
  lifestyle: { diet, smoking, drinking, hobbies[], hyper_niche_tags[] },
  horoscope: { rashi, nakshatra, dob, tob, pob, manglik, chartImage },
  partnerPreferences: { ageRange, income, education, religion, location },
  safetyMode: { contactHidden: Boolean, unlockedWith: [userId] },
  aiEmbedding: [Number],   // sentence-transformer vector (1536-dim)
}

// wedding_plans
{
  weddingId: String,
  theme: { name, colorPalette, moodBoard: [r2Keys] },
  timeline: [{ date, event, description }],
  budget: { total, categories: [{ name, allocated, spent }] },
  checklist: [{ item, done, dueDate }],
  ceremonies: [{ type, date, venue, vendors: [] }]
}

// chats — one document per matched pair
{
  participants: [userId1, userId2],
  matchRequestId: String,
  messages: [{
    _id, senderId, content, type,     // type: text | photo | system
    sentAt, readAt, translatedContent  // Hindi-English pair
  }],
  lastMessage: { content, sentAt }
}

// vendor_portfolios
{
  vendorId: String,
  about: String,
  portfolio: [{ title, description, r2Keys: [], eventDate }],
  packages: [{ name, price, inclusions: [], r2Keys: [] }],
  eventTypes: [String],    // wedding, corporate, festival, school…
  availabilityCalendar: {} // sparse, checked against PostgreSQL
}
```

### Redis — Cache & Queues

```
sessions:{userId}           → JWT session data (TTL: 30 days)
match_scores:{userId}       → Pre-computed top matches (TTL: 7 days)
match_feed:{userId}         → Daily AI-generated match feed (TTL: 24h)
otp:{phone}                 → OTP verification code (TTL: 10 min)
rate_limit:{ip}:{route}     → API rate limit counters (TTL: 1 min)
queue:notifications         → Bull job queue — push/SMS/email dispatch
queue:match-compute         → Bull job queue — nightly match recalculation
queue:escrow-release        → Bull job queue — 48h escrow auto-release
socket:adapter:*            → Socket.io multi-instance adapter
```

---

## Authentication Flow

```
1. User enters phone number
2. API → MSG91 → OTP sent to phone
3. User enters OTP
4. API verifies OTP (Redis TTL check)
5. If first login: create user record, assign role
6. Generate: access token (JWT, 15m) + refresh token (opaque, 30d)
7. Access token → Authorization: Bearer header
8. Refresh token → httpOnly cookie (SameSite=Strict)
9. On expiry: POST /auth/refresh → new access token
10. On logout: delete session from Redis, expire refresh cookie
```

---

## Reciprocal Matching Algorithm

```
For user A requesting matches:
1. Apply hard filters from A's partner preferences (age, religion, location radius)
2. For each candidate B remaining:
   a. Apply hard filters from B's partner preferences against A's profile
   b. If A doesn't pass B's filters → REMOVE (reciprocal check)
3. Score remaining candidates:
   - Demographic alignment (25%)
   - Lifestyle compatibility (20%)
   - Guna Milan score / 36, normalised (20%)
   - Semantic embedding similarity (20%)
   - Preference overlap score (15%)
4. Sort by score desc, cache top 20 in Redis
5. Return paginated results from cache (< 10ms)

Batch recalculation: nightly at 2 AM via Bull queue
```

---

## Guna Milan — Ashtakoot System

All 8 factors computed in `apps/ai-service/routers/horoscope.py`:

| Factor | Max Points | What It Measures |
|--------|-----------|-----------------|
| Varna | 1 | Spiritual compatibility |
| Vashya | 2 | Dominance and control |
| Tara | 3 | Birth star compatibility |
| Yoni | 4 | Biological compatibility |
| Graha Maitri | 5 | Mental/intellectual compatibility |
| Gana | 6 | Temperament match |
| Bhakoot | 7 | Emotional/health compatibility |
| Nadi | 8 | Genetic/physical compatibility |
| **Total** | **36** | |

Score display: `n/36` or as `percentage`. Mangal Dosha flagged separately.

---

## Escrow Payment Flow

```
1. Customer confirms booking
2. Razorpay order created: 50% of total amount
3. Customer pays → Razorpay webhook confirms
4. Payment record: status = ESCROW_HELD
5. Event date passes
6. Bull queue: schedule escrow-release job for T+48h
7. T+48h: if no dispute → auto-release via Razorpay Transfer to vendor
8. If dispute raised before T+48h → status = DISPUTED → admin review
9. Admin resolves → manual release or partial refund via Razorpay
10. Audit log entry created for every state transition
```

---

## Real-Time Chat Architecture

```
Socket.io server on Node.js API
├── Namespace: /chat
├── Rooms named by matchRequestId
│
├── Events (client → server):
│   ├── join_room         → Join a specific match chat room
│   ├── send_message      → Send text or photo message
│   ├── mark_read         → Mark messages as read
│   └── typing            → Typing indicator
│
└── Events (server → client):
    ├── message_received  → New message in room
    ├── message_read      → Read receipts update
    ├── user_typing       → Typing indicator
    └── match_accepted    → Real-time match acceptance notification

Message flow:
1. Client emits send_message
2. Server saves to MongoDB (chats collection)
3. Server emits message_received to all room members
4. Translation: if sender language ≠ receiver, translate via AI service
5. Bull queue: fire push notification if receiver not in room
```

---

## Security Architecture

| Layer | Implementation |
|-------|---------------|
| Transport | HTTPS everywhere · HSTS headers |
| Auth | JWT (15m) + httpOnly refresh cookie · SameSite=Strict |
| Authorization | `authenticate()` → `authorize(roles[])` middleware |
| Input validation | Zod schemas on every endpoint — never trust raw input |
| Rate limiting | Per-IP + per-user via Redis counters |
| Contact privacy | Phone/email masked in all API responses by default |
| Media privacy | R2 pre-signed URLs (expiring, not public bucket) |
| Payment | Razorpay tokenisation — raw card data never touches our servers |
| KYC data | Verification status only — raw Aadhaar never stored |
| SQL injection | Drizzle parameterised queries — no raw SQL |
| XSS | Helmet.js headers · Next.js output encoding |
| GDPR | Consent management · right to deletion · data portability endpoint |
| Audit trail | Immutable hash-chained log for KYC, payment, contract events |
| Fraud | AWS Rekognition (photo) + Isolation Forest (payment anomalies) |

---

## Infrastructure (Phase 1–4 — Railway + Vercel)

```
Vercel:          Next.js web app (auto-deploy from main branch)
Railway Project:
  ├── API Service       → Node.js/Express (auto-deploy from main)
  ├── AI Service        → Python/FastAPI (auto-deploy from main)
  ├── PostgreSQL        → Railway managed (daily backups)
  └── Redis             → Railway managed (persistent)
MongoDB Atlas:    M0 free tier → M10 at Phase 5+
Cloudflare R2:    Media storage (10GB free, no egress fees)
AWS SES:          Transactional email (₹0.07 per 1000)
MSG91:            Indian OTP and transactional SMS
```

---

## Deployment Pipeline

```
Developer pushes to feature branch
    ↓
GitHub Actions:
    pnpm lint --fix
    pnpm type-check
    pnpm test (Vitest)
    pnpm e2e (Playwright — against preview)
    ↓ (if all pass)
Vercel Preview URL (web app)
Railway Preview Environment (API + AI service)
    ↓ (PR merged to main)
Vercel Production deploy (automatic)
Railway Production deploy (automatic)
    ↓
Sentry release tracking
PostHog deployment marker
BetterStack uptime verification
```

---

## AI Model Architecture (Phase 3)

```
Rule-based (Phase 1–2, active from launch):
  Compatibility score = weighted sum of demographic + lifestyle + preference rules
  Guna Milan = deterministic Vedic algorithm
  Conversation Coach = profile interest pattern matching

Lightweight ML (Phase 3, activated when data > 500 profiles):
  Sentence-transformer embeddings → cosine similarity for profile text
  Logistic regression → churn prediction
  Isolation Forest → payment fraud anomaly detection

Full ML (Phase 3+, activated as data grows):
  Collaborative filtering → "users like you connected with..."
  Hybrid embedding + CF → daily match feed personalisation
  Gradient boosting → marriage readiness composite score

LLM (Phase 3):
  Claude API via Helicone proxy
  Model routing: Haiku for classification → Sonnet for complex reasoning
  Prompt caching for system prompts > 1024 tokens (saves 90%)
  All prompts versioned in /prompts/ directory
```

---

## Architecture Decision Records

| Decision | Choice | Reason |
|----------|--------|--------|
| Monolith vs microservices | Modular monolith | Avoids distributed complexity during build phase |
| ORM | Drizzle (PostgreSQL) + Mongoose (MongoDB) | Type-safe, zero cold-start impact |
| Auth library | Better Auth | Full ownership, no vendor lock-in, supports OTP |
| Mobile framework | React Native + Expo | 90% code share with web TypeScript codebase |
| Media storage | Cloudflare R2 | Zero egress fees — critical for image-heavy platform |
| Payment gateway | Razorpay only (Phase 1–4) | Best UPI + subscription + escrow support in India |
| AI service language | Python (FastAPI) | Scikit-learn, HuggingFace, PyTorch ecosystem |
| Hosting (Phase 1–4) | Railway + Vercel | Zero DevOps overhead, auto-deploy, managed DBs |
| Message queue | Bull + Redis | Mature, TypeScript-native, no separate broker needed |
