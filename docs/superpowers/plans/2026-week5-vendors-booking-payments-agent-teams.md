# Week 5 — Vendors + Booking + Payments: Agent Teams Plan
# VivahOS Infinity · Phase 1 · Days 21–25
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1 + 2) → Single Agent (Phase 3 dashboards)

> Biggest week of Phase 1. Three genuinely independent domains.
> All payments mocked behind USE_MOCK_SERVICES=true — no Razorpay registration needed.
> No plan approval mode. Teammates plan in 3 lines then implement immediately.
> index.ts coordination protocol same as Week 4 — strict mount order.

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Confirm status
cat CLAUDE.md | head -30

# 2. Week target
grep -A15 "Week 5" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 1 | Week: 5 | Focus: Vendors + Booking + Payments | Status: Starting

# 4. Infrastructure
docker compose up -d
pnpm dev

# 5. Agent Teams enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # must print 1
```

---

## ─── PHASE 0: Single Agent (8:00–9:30) ──────────────────────────────────

> Shared types, schemas, and dependencies only.
> Commit before any teammate spawns.

### Research prompt (8:00–8:20)

```
Read these files fully before touching anything:
- packages/db/schema/index.ts lines 376–670  (vendors, bookings, payments,
  escrow, products, orders tables)
- packages/types/src/index.ts                (what types exist)
- packages/schemas/src/index.ts              (what schemas exist)
- apps/api/src/index.ts                      (what routers are mounted)
- apps/api/package.json                      (what is installed)
- docs/API.md vendors + bookings + payments sections
- docs/DATABASE.md escrow flow section
- ARCHITECTURE.md Escrow Payment Flow section

Summarise what exists. Confirm Phase 0 jobs below are correct.
Do NOT write any code yet.
```

### Phase 0 jobs (8:20–9:30)

#### Job 1 — Install dependencies
```bash
pnpm --filter @vivah/api add razorpay pdfkit
pnpm --filter @vivah/api add -D @types/pdfkit
```

#### Job 2 — Create `packages/types/src/vendor.ts`
```typescript
export const VendorCategory = {
  PHOTOGRAPHY:    'PHOTOGRAPHY',
  CATERING:       'CATERING',
  DECORATION:     'DECORATION',
  VENUE:          'VENUE',
  MUSIC:          'MUSIC',
  MEHENDI:        'MEHENDI',
  MAKEUP:         'MAKEUP',
  INVITATION:     'INVITATION',
  TRANSPORT:      'TRANSPORT',
  OTHER:          'OTHER',
} as const
export type VendorCategory = typeof VendorCategory[keyof typeof VendorCategory]

export const BookingStatus = {
  PENDING:    'PENDING',
  CONFIRMED:  'CONFIRMED',
  COMPLETED:  'COMPLETED',
  CANCELLED:  'CANCELLED',
  DISPUTED:   'DISPUTED',
} as const
export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus]

export const PaymentStatus = {
  PENDING:       'PENDING',
  ESCROW_HELD:   'ESCROW_HELD',
  RELEASED:      'RELEASED',
  REFUNDED:      'REFUNDED',
  FAILED:        'FAILED',
} as const
export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus]

export interface VendorProfile {
  id:             string
  businessName:   string
  category:       VendorCategory
  city:           string
  state:          string
  rating:         number
  totalReviews:   number
  verified:       boolean
  services:       VendorService[]
  portfolioKey:   string | null   // MongoDB portfolio reference
}

export interface VendorService {
  id:           string
  name:         string
  priceFrom:    number
  priceTo:      number | null
  unit:         string
  description:  string | null
}

export interface BookingSummary {
  id:           string
  vendorId:     string
  vendorName:   string
  serviceId:    string | null
  eventDate:    string
  status:       BookingStatus
  totalAmount:  number
  escrowAmount: number | null
  createdAt:    string
}

export interface PaymentOrder {
  razorpayOrderId:  string
  amount:           number
  currency:         string
  bookingId:        string
}

export interface InvoiceData {
  bookingId:    string
  customerName: string
  vendorName:   string
  serviceNames: string[]
  eventDate:    string
  totalAmount:  number
  paidAmount:   number
  invoiceDate:  string
  invoiceNo:    string
}
```

#### Job 3 — Create `packages/schemas/src/vendor.ts`
```typescript
import { z } from 'zod'

export const VendorListQuerySchema = z.object({
  category: z.string().optional(),
  city:     z.string().optional(),
  state:    z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(20).default(10),
})

export const CreateVendorSchema = z.object({
  businessName: z.string().min(2).max(255),
  category:     z.string(),
  city:         z.string().min(2).max(100),
  state:        z.string().min(2).max(100),
})

export const CreateServiceSchema = z.object({
  name:        z.string().min(2).max(255),
  priceFrom:   z.number().positive(),
  priceTo:     z.number().positive().optional(),
  unit:        z.string().max(50),
  description: z.string().max(1000).optional(),
})

export const CreateBookingSchema = z.object({
  vendorId:     z.string().uuid(),
  serviceId:    z.string().uuid().optional(),
  eventDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ceremonyType: z.string().optional(),
  notes:        z.string().max(1000).optional(),
  totalAmount:  z.number().positive(),
})

export const CreatePaymentOrderSchema = z.object({
  bookingId: z.string().uuid(),
})

export const RefundSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const DisputeSchema = z.object({
  reason: z.string().min(10).max(1000),
})

export type VendorListQuery      = z.infer<typeof VendorListQuerySchema>
export type CreateVendorInput    = z.infer<typeof CreateVendorSchema>
export type CreateServiceInput   = z.infer<typeof CreateServiceSchema>
export type CreateBookingInput   = z.infer<typeof CreateBookingSchema>
export type CreatePaymentInput   = z.infer<typeof CreatePaymentOrderSchema>
export type RefundInput          = z.infer<typeof RefundSchema>
export type DisputeInput         = z.infer<typeof DisputeSchema>
```

#### Job 4 — Barrel exports
```
packages/types/src/index.ts   → add: export * from './vendor.js'
packages/schemas/src/index.ts → add: export * from './vendor.js'
```

#### Job 5 — Create Razorpay mock client
Create `apps/api/src/lib/razorpay.ts`:
```typescript
// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set USE_MOCK_SERVICES=false once Razorpay merchant account approved
// Real implementation: replace mock blocks with actual Razorpay SDK calls
// ─────────────────────────────────────────────────────────────────────────────
import { env } from './env.js'

const USE_MOCK = env.USE_MOCK_SERVICES === 'true'

export interface RazorpayOrder {
  id:       string
  amount:   number
  currency: string
  status:   string
}

export interface RazorpayRefund {
  id:     string
  amount: number
  status: string
}

export async function createOrder(
  amount: number,
  currency = 'INR',
  receipt: string,
): Promise<RazorpayOrder> {
  if (USE_MOCK) {
    return {
      id:       `mock_order_${Date.now()}`,
      amount,
      currency,
      status:   'created',
    }
  }
  // TODO: real Razorpay SDK call
  throw new Error('Razorpay not configured')
}

export async function verifyWebhookSignature(
  body: string,
  signature: string,
): Promise<boolean> {
  if (USE_MOCK) return true
  // TODO: crypto.createHmac verify
  throw new Error('Razorpay not configured')
}

export async function createRefund(
  paymentId: string,
  amount: number,
): Promise<RazorpayRefund> {
  if (USE_MOCK) {
    return {
      id:     `mock_refund_${Date.now()}`,
      amount,
      status: 'processed',
    }
  }
  // TODO: real Razorpay refund call
  throw new Error('Razorpay not configured')
}

export async function transferToVendor(
  vendorAccountId: string,
  amount: number,
): Promise<{ id: string }> {
  if (USE_MOCK) {
    return { id: `mock_transfer_${Date.now()}` }
  }
  // TODO: Razorpay route/transfer
  throw new Error('Razorpay not configured')
}
```

#### Phase 0 commit (9:30)
```bash
pnpm --filter @vivah/types build
pnpm --filter @vivah/schemas build
pnpm type-check   # zero errors required
git add -A
git commit -m "feat(types,schemas,lib): vendor+booking+payment contracts + razorpay mock"
git push
```

> ✅ STOP. Agent Team takes over from here.

---

## ─── PHASE 1: Agent Team — Core Build (9:30–13:00) ─────────────────────

> 3 teammates. No plan approval. Plan in 3 lines then implement.

### Team spawn prompt

```
We are building Week 5 of VivahOS Infinity — vendors, booking state machine,
and payments with escrow. Phase 0 is complete and committed:
- Shared types: packages/types/src/vendor.ts
- Shared schemas: packages/schemas/src/vendor.ts
- Razorpay mock: apps/api/src/lib/razorpay.ts
- Dependencies: razorpay + pdfkit installed

Create an agent team with exactly 3 teammates.
NO plan approval. Each teammate writes a 3-line plan then implements immediately.

Quality bar for all teammates:
- TypeScript strict — no any
- API envelope: { success, data, error, meta } always
- All queries filtered by userId — multi-tenant safety non-negotiable
- authenticate() on every protected endpoint
- USE_MOCK_SERVICES=true for all external calls — never call real Razorpay
- pnpm type-check must pass before marking task complete
- Git checkpoint before risky file writes

─── TEAMMATE 1: vendors ──────────────────────────────────────────────────────
Domain: apps/api/src/vendors/
Files you OWN:
  - apps/api/src/vendors/service.ts              (CREATE)
  - apps/api/src/vendors/router.ts               (CREATE)
  - apps/api/src/vendors/__tests__/service.test.ts (CREATE)
  - apps/web/src/app/(app)/vendors/page.tsx      (CREATE)
  - apps/web/src/app/(app)/vendors/[id]/page.tsx (CREATE)
  - apps/web/src/components/vendor/VendorCard.tsx (CREATE)
  - apps/web/src/components/vendor/VendorPortfolio.tsx (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 376–415 (vendors, vendorServices, vendorEvents)
  - docs/API.md vendors section
  - docs/DATABASE.md MongoDB vendor_portfolios collection
  - apps/api/src/infrastructure/mongo/models/ (existing models)
  - .claude/commands/ui-component.md (design system)

Tasks in order:
1. Create apps/api/src/infrastructure/mongo/models/VendorPortfolio.ts
   Schema from docs/DATABASE.md vendor_portfolios collection exactly.

2. service.ts:
   listVendors(query: VendorListQuery) → paginated vendors with services
     Filter: category, city, state. JOIN vendorServices.
     Return: VendorProfile[] with meta { page, total, limit }
   getVendor(vendorId) → full vendor profile + portfolio from MongoDB
   createVendor(userId, input: CreateVendorInput) → insert vendors row
   addService(vendorId, userId, input: CreateServiceInput) → insert vendorServices
   getAvailability(vendorId, month: string) → dates vendor is booked
     Query bookings table for CONFIRMED bookings in that month

3. Write service.test.ts before implementing:
   - listVendors: category filter works, pagination correct
   - getVendor: returns combined PG + MongoDB data
   - createVendor: duplicate userId rejected
   - getAvailability: returns booked dates array

4. router.ts — all endpoints:
   GET  /vendors                → listVendors (public — no auth needed)
   GET  /vendors/:id            → getVendor (public)
   GET  /vendors/:id/availability → getAvailability (public)
   POST /vendors                → createVendor (authenticate())
   POST /vendors/:id/services   → addService (authenticate(), vendor only)

5. Web pages:
   vendors/page.tsx — Server Component:
   - Filter bar: category dropdown, city input (Client Component)
   - VendorCard grid: 2 cols mobile, 3 cols desktop
   - Pagination controls

   vendors/[id]/page.tsx — Server Component:
   - VendorPortfolio: photo gallery, packages, about
   - "Book Now" CTA button → /bookings/new?vendorId=:id
   - Rating display, verified badge (Peacock Teal #0E7C7B)
   - Design system: Ivory #FEFAF6 bg, Gold #C5A47E borders

   VendorCard.tsx:
   - Business name (Playfair Display, Burgundy #7B2D42)
   - Category badge, city, rating stars
   - Price range from vendorServices
   - Verified badge if vendor.verified
   - min-h touch targets on Book CTA

6. pnpm type-check && pnpm --filter @vivah/api test
7. Commit: feat(vendors): vendor listing + portfolio + availability

─── TEAMMATE 2: bookings ─────────────────────────────────────────────────────
Domain: apps/api/src/bookings/
Files you OWN:
  - apps/api/src/bookings/service.ts              (CREATE)
  - apps/api/src/bookings/router.ts               (CREATE)
  - apps/api/src/bookings/invoice.ts              (CREATE)
  - apps/api/src/bookings/__tests__/service.test.ts (CREATE)
  - apps/web/src/app/(app)/bookings/page.tsx      (CREATE)
  - apps/web/src/app/(app)/bookings/[id]/page.tsx (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 418–465 (bookings, payments, escrowAccounts)
  - ARCHITECTURE.md Escrow Payment Flow section (full state machine)
  - docs/API.md bookings section
  - apps/api/src/infrastructure/redis/queues.ts (Bull queue for escrow-release)

Tasks in order:
1. service.ts — full booking state machine:
   createBooking(customerId, input: CreateBookingInput)
     → check vendor availability (no conflict on eventDate)
     → insert bookings row status=PENDING
     → push notification to vendor: NEW_BOOKING_REQUEST
   confirmBooking(vendorId, bookingId)
     → verify vendorId matches booking.vendorId
     → update status PENDING → CONFIRMED
     → notify customer: BOOKING_CONFIRMED
   cancelBooking(userId, bookingId, reason?)
     → verify userId is customer or vendor
     → update status → CANCELLED
     → if payment exists and ESCROW_HELD → trigger refund via razorpay.ts
   completeBooking(bookingId)
     → update status CONFIRMED → COMPLETED
     → schedule escrow release: Bull job queue:escrow-release delayed 48h
       payload: { escrowId, bookingId, vendorId, amount: escrowAccount.totalHeld }
   getBookings(userId, role: 'customer'|'vendor') → paginated bookings list
   getBooking(userId, bookingId) → single booking with payment status

2. invoice.ts — PDF generation via pdfkit:
   generateInvoice(data: InvoiceData) → Buffer
   - VivahOS header with Royal Burgundy #7B2D42
   - Invoice number, date, booking details
   - Line items table
   - Total amount in INR
   - "Powered by VivahOS" footer
   Route: GET /bookings/:id/invoice → authenticate() → res.setHeader PDF → send Buffer

3. Write service.test.ts:
   - createBooking: conflict detection (same vendor, same date)
   - confirmBooking: wrong vendor rejected
   - completeBooking: Bull job enqueued with correct 48h delay
   - cancelBooking: ESCROW_HELD → refund triggered

4. router.ts:
   POST /bookings                    → createBooking (authenticate())
   GET  /bookings                    → getBookings (authenticate())
   GET  /bookings/:id                → getBooking (authenticate())
   PUT  /bookings/:id/confirm        → confirmBooking (authenticate(), vendor)
   PUT  /bookings/:id/cancel         → cancelBooking (authenticate())
   PUT  /bookings/:id/complete       → completeBooking (authenticate())
   GET  /bookings/:id/invoice        → generateInvoice PDF (authenticate())

5. Web pages:
   bookings/page.tsx — Server Component:
   - List customer bookings with status badges
   - Status colours: PENDING=amber, CONFIRMED=teal, COMPLETED=green, CANCELLED=gray
   - "Download Invoice" button for COMPLETED bookings

   bookings/[id]/page.tsx:
   - Full booking detail: vendor, service, date, amount
   - Escrow status indicator
   - Action buttons based on status (confirm/cancel/complete)

6. pnpm type-check && pnpm --filter @vivah/api test
7. Commit: feat(bookings): booking state machine + escrow scheduling + invoice PDF

─── TEAMMATE 3: payments ─────────────────────────────────────────────────────
Domain: apps/api/src/payments/
Files you OWN:
  - apps/api/src/payments/service.ts              (CREATE)
  - apps/api/src/payments/router.ts               (CREATE)
  - apps/api/src/payments/webhook.ts              (CREATE)
  - apps/api/src/jobs/escrowReleaseJob.ts         (CREATE)
  - apps/api/src/payments/__tests__/service.test.ts (CREATE)
  - apps/api/src/payments/__tests__/webhook.test.ts (CREATE)
  - apps/web/src/app/(app)/payments/page.tsx      (CREATE)

Context — read first:
  - packages/db/schema/index.ts lines 438–470 (payments, escrowAccounts, auditLogs)
  - ARCHITECTURE.md Escrow Payment Flow section
  - apps/api/src/lib/razorpay.ts (mock client you will use)
  - apps/api/src/infrastructure/redis/queues.ts
  - docs/API.md payments section
  - docs/DATABASE.md audit_logs table (immutable, append-only)

Tasks in order:
1. service.ts:
   createPaymentOrder(userId, input: CreatePaymentInput) → PaymentOrder
     → verify booking belongs to userId
     → verify booking status is CONFIRMED
     → calculate escrow amount (50% of booking.totalAmount)
     → call razorpay.createOrder(escrowAmount, 'INR', bookingId)
     → insert payments row status=PENDING
     → return PaymentOrder
   handlePaymentSuccess(razorpayOrderId, razorpayPaymentId)
     → update payment status → ESCROW_HELD
     → insert escrowAccounts row
     → append audit_log: PAYMENT_RECEIVED (hash-chained)
   requestRefund(userId, paymentId, input: RefundInput)
     → verify userId is customer
     → call razorpay.createRefund()
     → update payment status → REFUNDED
     → audit_log: REFUND_ISSUED
   getPaymentHistory(userId) → paginated payments list
   getEscrowStatus(bookingId) → escrowAccount details

2. webhook.ts — Razorpay webhook handler:
   POST /payments/webhook (NO authenticate — verified by signature)
   → call razorpay.verifyWebhookSignature(body, signature)
   → if invalid → 400
   → route by event type:
     payment.captured → handlePaymentSuccess()
     refund.processed → update payment REFUNDED
     dispute.created  → update booking DISPUTED, notify admin

3. escrowReleaseJob.ts — Bull job processor:
   queue: queue:escrow-release
   On job: { escrowId, bookingId, vendorId, amount }
   → check booking not DISPUTED
   → call razorpay.transferToVendor(vendorId, amount)
   → update escrowAccounts status → RELEASED
   → update escrowAccounts.released = amount
   → audit_log: ESCROW_RELEASED (hash-chained)
   Register processor in apps/api/src/infrastructure/redis/queues.ts

4. Write tests:
   service.test.ts:
   - createPaymentOrder: wrong user rejected, unconfirmed booking rejected
   - handlePaymentSuccess: escrow record created, audit log appended
   - requestRefund: non-customer rejected
   webhook.test.ts:
   - Invalid signature → 400
   - payment.captured event → handlePaymentSuccess called
   - dispute.created → booking status DISPUTED

5. router.ts:
   POST /payments/order          → createPaymentOrder (authenticate())
   POST /payments/webhook        → webhook handler (NO auth, raw body)
   GET  /payments/history        → getPaymentHistory (authenticate())
   POST /payments/refund/:id     → requestRefund (authenticate())
   GET  /payments/escrow/:bookingId → getEscrowStatus (authenticate())

6. Web page:
   payments/page.tsx — Server Component:
   - Payment history list with status badges
   - Escrow status indicator per booking
   - Amount in ₹ (Indian Rupee format)

7. pnpm type-check && pnpm --filter @vivah/api test
8. Commit: feat(payments): razorpay mock + escrow flow + webhook + audit log

─── SHARED RULES ─────────────────────────────────────────────────────────────
- Never touch a file owned by another teammate
- index.ts: add router mounts via a message to the lead after committing
  Lead handles all three router mounts in one go after all teammates commit
- USE_MOCK_SERVICES=true always — never call real Razorpay
- Audit logs are IMMUTABLE — never UPDATE or DELETE audit_logs rows
- Escrow amount is always exactly 50% of booking.totalAmount
- /compact when context hits 70%
- Mark task complete immediately after commit
```

---

## ─── PHASE 2: Dashboards + Integration (14:00–17:00) ───────────────────

> Single agent. Shut team down first. Three dashboards + router wiring.

### Shutdown + mount prompt
```
Ask all teammates to shut down. Clean up the team.

Then as single agent:

1. Mount all three routers in apps/api/src/index.ts:
   import { vendorRouter }  from './vendors/router.js'
   import { bookingRouter } from './bookings/router.js'
   import { paymentRouter } from './payments/router.js'

   app.use('/api/v1/vendors',  vendorRouter)
   app.use('/api/v1/bookings', bookingRouter)
   app.use('/api/v1/payments', paymentRouter)

2. Register escrowReleaseJob processor in infrastructure/redis/queues.ts

3. Build Customer Dashboard — apps/web/src/app/(app)/dashboard/page.tsx:
   Server Component. 4 stat cards:
   - Active Matches (query matchmaking)
   - Upcoming Bookings (query bookings, status CONFIRMED)
   - Pending Requests (query match_requests received)
   - Profile Completeness % (from profiles)
   Design: Ivory #FEFAF6 bg, Gold #C5A47E card borders,
   Teal #0E7C7B stat numbers, Burgundy #7B2D42 headings
   Recent activity feed below stat cards.

4. Build Vendor Dashboard — apps/web/src/app/(app)/vendor-dashboard/page.tsx:
   Server Component. 4 stat cards:
   - Pending Bookings
   - Confirmed Bookings this month
   - Total Revenue (sum of COMPLETED booking amounts)
   - Average Rating
   Booking queue list below: each row has confirm/decline actions.

5. Build Admin Dashboard — apps/web/src/app/(app)/admin/page.tsx:
   Server Component (ADMIN role only — redirect if not admin).
   4 stat cards:
   - Total Users
   - Pending KYC Reviews
   - Active Vendors
   - Bookings This Month
   KYC pending queue table.
   Recent audit logs table (last 20 entries).

6. Run full smoke test:
   □ GET /api/v1/vendors → 200, paginated list
   □ GET /api/v1/vendors/:id → 200, vendor + portfolio
   □ POST /api/v1/bookings → 201, booking created
   □ PUT /api/v1/bookings/:id/confirm → 200
   □ POST /api/v1/payments/order → 200, mock Razorpay order returned
   □ POST /api/v1/payments/webhook (mock payload) → 200, escrow created
   □ GET /api/v1/payments/escrow/:bookingId → 200, escrow status
   □ GET /api/v1/bookings/:id/invoice → 200, PDF binary returned
   □ Web: /vendors page loads, shows vendor cards
   □ Web: /bookings page loads, shows booking list
   □ Web: /dashboard loads all 4 stat cards

7. pnpm type-check && pnpm test
8. Document failures: docs/smoke-test-week5.md

9. Commit: feat(dashboards): customer + vendor + admin dashboards + router mounts
```

---

## ─── Session End (17:30–18:00) ──────────────────────────────────────────

```bash
pnpm type-check && pnpm test

git add -A
git commit -m "feat(vendors,bookings,payments): week 5 complete — Phase 1 production ready"
git push
```

Update ROADMAP.md — mark done:
```
✅ Vendor listing pages (category + city filter)
✅ Vendor portfolio pages (photos, packages, pricing)
✅ Booking system: request → confirm → schedule → complete
✅ Booking system: cancellation flow
✅ Razorpay integration (mocked — USE_MOCK_SERVICES=true)
✅ Invoice generation (PDF via pdfkit)
✅ Refund handling (Razorpay refund API mocked)
✅ Customer dashboard
✅ Vendor dashboard
✅ Admin dashboard
```

Add blocker notes:
```
[2026-week5] Razorpay live keys needed — swap USE_MOCK_SERVICES=false after merchant approval
[2026-week5] Vendor transfer account IDs needed for escrow release (currently mock)
[2026-week5] Notification worker not yet consuming queues — wire in Phase 2
```

Update CLAUDE.md:
```
Phase:   1 → COMPLETE
Week:    5 → DONE
Focus:   Phase 2 Wedding Planning
Status:  Starting Week 6
Mocks:   USE_MOCK_SERVICES=true (swap after company registration)
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `packages/types/src/vendor.ts` | Single agent | Phase 0 |
| `packages/schemas/src/vendor.ts` | Single agent | Phase 0 |
| `apps/api/src/lib/razorpay.ts` | Single agent | Phase 0 |
| `vendors/service.ts + router.ts` | Teammate 1 | Phase 1 |
| `infrastructure/mongo/models/VendorPortfolio.ts` | Teammate 1 | Phase 1 |
| `web/app/(app)/vendors/` | Teammate 1 | Phase 1 |
| `web/components/vendor/` | Teammate 1 | Phase 1 |
| `bookings/service.ts + router.ts + invoice.ts` | Teammate 2 | Phase 1 |
| `web/app/(app)/bookings/` | Teammate 2 | Phase 1 |
| `payments/service.ts + router.ts + webhook.ts` | Teammate 3 | Phase 1 |
| `jobs/escrowReleaseJob.ts` | Teammate 3 | Phase 1 |
| `web/app/(app)/payments/` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Single agent | Phase 2 only |
| `web/app/(app)/dashboard/` | Single agent | Phase 2 |
| `web/app/(app)/vendor-dashboard/` | Single agent | Phase 2 |
| `web/app/(app)/admin/` | Single agent | Phase 2 |

---

## Dependency Chain

```
Phase 0 (single agent)
  └── types + schemas + razorpay mock committed
        ├── Teammate 1 (vendors) — independent, starts immediately
        ├── Teammate 2 (bookings) — independent, starts immediately
        └── Teammate 3 (payments) — independent, starts immediately
              └── Phase 2 single agent:
                    - Mount all 3 routers in index.ts
                    - Register escrowReleaseJob
                    - Build 3 dashboards
```

---

## Critical Invariants

| Rule | Reason |
|------|--------|
| Escrow = exactly 50% of totalAmount | Architecture spec — never deviate |
| Audit logs append-only | Immutable hash-chained — never UPDATE/DELETE |
| Webhook has no authenticate() | Razorpay calls it — verified by signature only |
| USE_MOCK_SERVICES=true always | Company not registered — never call real Razorpay |
| Booking conflict check before create | Two vendors can't be double-booked |
| Escrow release delayed 48h | Dispute window — Bull delayed job, not immediate |

---

## WSL Agent Teams Rules

```
✅ No plan approval — teammates plan in 3 lines then implement
✅ If teammate goes idle — respawn: "claim task X, no plan mode, implement now"
✅ index.ts touched by single agent in Phase 2 only — not by any teammate
✅ watch -n 3 "ls -la [dir]" in second terminal for file activity
✅ 3 teammates max on Max 5x budget
✅ /compact at 70% context in each teammate
```

---

## Test Coverage Requirements

| Module | Required | Key Cases |
|--------|----------|-----------|
| `vendors/service.ts` | 80%+ | Filters, pagination, availability conflict |
| `bookings/service.ts` | 90%+ | State machine, conflict detection, escrow scheduling |
| `payments/service.ts` | 90%+ | Wrong user, unconfirmed booking, audit log chain |
| `payments/webhook.ts` | 100% | Invalid signature, all 3 event types |
| `jobs/escrowReleaseJob.ts` | 85%+ | Disputed booking blocked, transfer + audit log |
