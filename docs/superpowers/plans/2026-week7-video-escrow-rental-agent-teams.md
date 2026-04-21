# Week 7 — Video Calls + Escrow + Rental Module: Agent Teams Plan
# VivahOS Infinity · Phase 2 · Days 6–10
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1 + 2) → Single Agent (Phase 3)

> Three independent domains — video calls (Daily.co mocked), escrow dispute
> flow (extends existing escrow tables), rental catalogue (new schema).
> Rental and ceremonies tables added to PostgreSQL in Phase 0.
> No plan approval. Teammates plan in 3 lines then implement immediately.
> index.ts touched by single agent in Phase 3 only.

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Confirm status
cat CLAUDE.md | head -30

# 2. Week target
grep -A15 "Week 7" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 2 | Week: 7 | Focus: Video Calls + Escrow + Rental | Status: Starting

# 4. Infrastructure
docker compose up -d
pnpm dev

# 5. Agent Teams enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # must print 1
```

---

## ─── PHASE 0: Single Agent (8:00–10:00) ─────────────────────────────────

> Schema additions, shared types, Daily.co mock, dependencies.
> This is the heaviest Phase 0 yet — two new tables + shared contracts.
> Commit before any teammate spawns.

### Research prompt (8:00–8:20)

```
Read these files fully before touching anything:
- packages/db/schema/index.ts (full file — understand all existing tables)
- packages/types/src/index.ts
- packages/schemas/src/index.ts
- apps/api/src/index.ts
- apps/api/src/bookings/service.ts   (escrow flow already exists)
- apps/api/src/jobs/escrowReleaseJob.ts
- apps/api/package.json
- ROADMAP.md Phase 2 Week 7-8 items
- ARCHITECTURE.md Escrow Payment Flow section

Summarise what exists. Confirm Phase 0 jobs are correct.
Do NOT write any code yet.
```

### Phase 0 jobs (8:20–10:00)

#### Job 1 — Add rental + ceremonies tables to schema
Append to `packages/db/schema/index.ts` after the orders section:

```typescript
// ── Ceremonies ───────────────────────────────────────────────────────────────

export const ceremonyTypeEnum = pgEnum('ceremony_type', [
  'HALDI', 'MEHNDI', 'SANGEET', 'WEDDING', 'RECEPTION', 'ENGAGEMENT', 'OTHER',
])

export const ceremonies = pgTable('ceremonies', {
  id:         uuid('id').primaryKey().defaultRandom(),
  weddingId:  uuid('wedding_id').notNull().references(() => weddings.id, { onDelete: 'cascade' }),
  type:       ceremonyTypeEnum('type').notNull(),
  date:       date('date'),
  venue:      varchar('venue', { length: 255 }),
  startTime:  varchar('start_time', { length: 10 }),
  endTime:    varchar('end_time', { length: 10 }),
  notes:      text('notes'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ceremonies_wedding_idx').on(t.weddingId),
])

// ── Rentals ───────────────────────────────────────────────────────────────────

export const rentalCategoryEnum = pgEnum('rental_category', [
  'DECOR', 'COSTUME', 'AV_EQUIPMENT', 'FURNITURE', 'LIGHTING', 'TABLEWARE', 'OTHER',
])

export const rentalItems = pgTable('rental_items', {
  id:           uuid('id').primaryKey().defaultRandom(),
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 255 }).notNull(),
  description:  text('description'),
  category:     rentalCategoryEnum('category').notNull(),
  pricePerDay:  decimal('price_per_day', { precision: 12, scale: 2 }).notNull(),
  deposit:      decimal('deposit', { precision: 12, scale: 2 }).default('0').notNull(),
  stockQty:     integer('stock_qty').default(1).notNull(),
  r2ImageKeys:  text('r2_image_keys').array().default([]),
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('rental_items_vendor_idx').on(t.vendorId),
  index('rental_items_category_idx').on(t.category),
])

export const rentalBookingStatusEnum = pgEnum('rental_booking_status', [
  'PENDING', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CANCELLED', 'OVERDUE',
])

export const rentalBookings = pgTable('rental_bookings', {
  id:           uuid('id').primaryKey().defaultRandom(),
  rentalItemId: uuid('rental_item_id').notNull().references(() => rentalItems.id),
  customerId:   uuid('customer_id').notNull().references(() => users.id),
  fromDate:     date('from_date').notNull(),
  toDate:       date('to_date').notNull(),
  quantity:     integer('quantity').default(1).notNull(),
  totalAmount:  decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  depositPaid:  decimal('deposit_paid', { precision: 12, scale: 2 }).default('0').notNull(),
  status:       rentalBookingStatusEnum('status').default('PENDING').notNull(),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('rental_bookings_item_idx').on(t.rentalItemId),
  index('rental_bookings_customer_idx').on(t.customerId),
])
```

Add relations at bottom of schema:
```typescript
export const ceremoniesRelations = relations(ceremonies, ({ one }) => ({
  wedding: one(weddings, { fields: [ceremonies.weddingId], references: [weddings.id] }),
}))

export const rentalItemsRelations = relations(rentalItems, ({ one, many }) => ({
  vendor:   one(vendors,  { fields: [rentalItems.vendorId], references: [vendors.id] }),
  bookings: many(rentalBookings),
}))

export const rentalBookingsRelations = relations(rentalBookings, ({ one }) => ({
  item:     one(rentalItems, { fields: [rentalBookings.rentalItemId], references: [rentalItems.id] }),
  customer: one(users,       { fields: [rentalBookings.customerId],   references: [users.id] }),
}))
```

Push schema:
```bash
pnpm db:push
```

#### Job 2 — Install Daily.co SDK
```bash
pnpm --filter @smartshaadi/api add @daily-co/daily-js
```

Actually — Daily.co browser SDK is frontend only. For server-side room creation use their REST API directly. No package needed. Create a mock client instead.

Create `apps/api/src/lib/dailyco.ts`:
```typescript
// ─────────────────────────────────────────────────────────────────────────────
// SWAP FLAG: Set USE_MOCK_SERVICES=false once Daily.co API key is obtained
// Real: POST https://api.daily.co/v1/rooms with Authorization: Bearer {key}
// ─────────────────────────────────────────────────────────────────────────────
import { env } from './env.js'

const USE_MOCK = env.USE_MOCK_SERVICES === 'true'

export interface DailyRoom {
  id:        string
  name:      string
  url:       string
  createdAt: string
  expiresAt: string
}

export async function createRoom(
  name: string,
  expiryMinutes = 60,
): Promise<DailyRoom> {
  if (USE_MOCK) {
    const mockName = `mock-room-${name}-${Date.now()}`
    return {
      id:        `mock_${Date.now()}`,
      name:      mockName,
      url:       `https://smartshaadi.daily.co/${mockName}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60000).toISOString(),
    }
  }
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DAILY_CO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      properties: {
        exp: Math.floor(Date.now() / 1000) + expiryMinutes * 60,
        enable_chat: true,
        enable_knocking: true,
      },
    }),
  })
  if (!res.ok) throw new Error(`Daily.co error: ${res.status}`)
  return res.json()
}

export async function deleteRoom(roomName: string): Promise<void> {
  if (USE_MOCK) return
  await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.DAILY_CO_API_KEY}` },
  })
}
```

Add to `apps/api/src/lib/env.ts`:
```typescript
DAILY_CO_API_KEY: z.string().default('mock-daily-key'),
```

#### Job 3 — Create `packages/types/src/video.ts`
```typescript
export interface VideoRoom {
  roomId:    string
  roomName:  string
  roomUrl:   string
  token:     string  // participant token for joining
  expiresAt: string
  matchId:   string
}

export interface MeetingSchedule {
  id:          string
  matchId:     string
  proposedBy:  string
  scheduledAt: string
  durationMin: number
  roomUrl:     string | null
  status:      'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  notes:       string | null
}
```

#### Job 4 — Create `packages/types/src/rental.ts`
```typescript
export const RentalCategory = {
  DECOR:        'DECOR',
  COSTUME:      'COSTUME',
  AV_EQUIPMENT: 'AV_EQUIPMENT',
  FURNITURE:    'FURNITURE',
  LIGHTING:     'LIGHTING',
  TABLEWARE:    'TABLEWARE',
  OTHER:        'OTHER',
} as const
export type RentalCategory = typeof RentalCategory[keyof typeof RentalCategory]

export const RentalBookingStatus = {
  PENDING:   'PENDING',
  CONFIRMED: 'CONFIRMED',
  ACTIVE:    'ACTIVE',
  RETURNED:  'RETURNED',
  CANCELLED: 'CANCELLED',
  OVERDUE:   'OVERDUE',
} as const
export type RentalBookingStatus = typeof RentalBookingStatus[keyof typeof RentalBookingStatus]

export interface RentalItem {
  id:          string
  vendorId:    string
  name:        string
  description: string | null
  category:    RentalCategory
  pricePerDay: number
  deposit:     number
  stockQty:    number
  imageKeys:   string[]
  isActive:    boolean
}

export interface RentalBookingSummary {
  id:          string
  itemId:      string
  itemName:    string
  fromDate:    string
  toDate:      string
  quantity:    number
  totalAmount: number
  depositPaid: number
  status:      RentalBookingStatus
}
```

#### Job 5 — Create `packages/schemas/src/video.ts` + `packages/schemas/src/rental.ts`
```typescript
// video.ts
import { z } from 'zod'

export const CreateVideoRoomSchema = z.object({
  matchId:     z.string().uuid(),
  durationMin: z.number().int().min(15).max(120).default(60),
})

export const ScheduleMeetingSchema = z.object({
  matchId:     z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(120).default(60),
  notes:       z.string().max(500).optional(),
})

export const RespondMeetingSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
  notes:  z.string().max(500).optional(),
})

export type CreateVideoRoomInput  = z.infer<typeof CreateVideoRoomSchema>
export type ScheduleMeetingInput  = z.infer<typeof ScheduleMeetingSchema>
export type RespondMeetingInput   = z.infer<typeof RespondMeetingSchema>
```

```typescript
// rental.ts
import { z } from 'zod'

export const RentalListQuerySchema = z.object({
  category: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(20).default(10),
})

export const CreateRentalItemSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category:    z.enum(['DECOR','COSTUME','AV_EQUIPMENT','FURNITURE','LIGHTING','TABLEWARE','OTHER']),
  pricePerDay: z.number().positive(),
  deposit:     z.number().min(0).default(0),
  stockQty:    z.number().int().min(1).default(1),
})

export const CreateRentalBookingSchema = z.object({
  rentalItemId: z.string().uuid(),
  fromDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity:     z.number().int().min(1).default(1),
  notes:        z.string().max(500).optional(),
})

export const DisputeEscrowSchema = z.object({
  reason: z.string().min(10).max(1000),
})

export type RentalListQuery          = z.infer<typeof RentalListQuerySchema>
export type CreateRentalItemInput    = z.infer<typeof CreateRentalItemSchema>
export type CreateRentalBookingInput = z.infer<typeof CreateRentalBookingSchema>
export type DisputeEscrowInput       = z.infer<typeof DisputeEscrowSchema>
```

#### Job 6 — Barrel exports
```
packages/types/src/index.ts   → add:
  export * from './video.js'
  export * from './rental.js'

packages/schemas/src/index.ts → add:
  export * from './video.js'
  export * from './rental.js'
```

#### Phase 0 commit (10:00)
```bash
pnpm db:push                          # apply rental + ceremonies tables
pnpm --filter @smartshaadi/types build
pnpm --filter @smartshaadi/schemas build
pnpm type-check                       # zero errors required
git add -A
git commit -m "feat(schema,types): rental + ceremonies tables + video/rental shared contracts + daily.co mock"
git push
```

> ✅ STOP. Agent Team takes over.

---

## ─── PHASE 1: Agent Team — Core Build (10:00–14:00) ────────────────────

> 3 teammates. No plan approval. Plan in 3 lines then implement.

### Team spawn prompt

```
We are building Week 7 of VivahOS Infinity — video calls, escrow dispute
flow, and rental catalogue. Phase 0 is complete and committed:
- New tables: ceremonies, rental_items, rental_bookings (migrated)
- Shared types: packages/types/src/video.ts + rental.ts
- Shared schemas: packages/schemas/src/video.ts + rental.ts
- Daily.co mock client: apps/api/src/lib/dailyco.ts

Create an agent team with exactly 3 teammates.
NO plan approval. Each teammate writes a 3-line plan then implements immediately.

Quality bar for all teammates:
- TypeScript strict — no any
- API envelope: { success, data, error, meta } always
- All queries filtered by userId — multi-tenant safety non-negotiable
- authenticate() on every protected endpoint
- USE_MOCK_SERVICES=true — never call real Daily.co or Razorpay
- pnpm type-check must pass before marking task complete
- index.ts NOT touched by any teammate

─── TEAMMATE 1: video-calls ──────────────────────────────────────────────
Domain: apps/api/src/video/
Files you OWN:
  - apps/api/src/video/service.ts              (CREATE)
  - apps/api/src/video/router.ts               (CREATE)
  - apps/api/src/video/__tests__/service.test.ts (CREATE)
  - apps/web/src/app/(chat)/[matchId]/VideoCall.client.tsx (CREATE)

Context — read first:
  - apps/api/src/lib/dailyco.ts (mock client)
  - apps/api/src/infrastructure/mongo/models/Chat.ts
  - packages/db/schema/index.ts (match_requests table)
  - packages/types/src/video.ts
  - packages/schemas/src/video.ts
  - apps/api/src/auth/middleware.ts

Tasks in order:
1. service.ts:
   createVideoRoom(userId, matchId, durationMin)
     → verify user is participant in match_request (status ACCEPTED)
     → call dailyco.createRoom(roomName, durationMin)
     → append SYSTEM message to Chat:
       content: "Video call started — join: {roomUrl}"
       type: SYSTEM
     → emit via Socket.io to /chat room: { type: 'VIDEO_CALL_STARTED', roomUrl }
     → return VideoRoom

   endVideoRoom(userId, roomName)
     → verify user is participant
     → call dailyco.deleteRoom(roomName)
     → append SYSTEM message: "Video call ended"
     → return { success: true }

   scheduleMeeting(userId, input: ScheduleMeetingInput)
     → verify user is participant in match
     → store meeting in Redis:
       Key: meeting:{matchId}:{userId}
       Value: MeetingSchedule JSON
       TTL: 7 days
     → notify other participant via Bull queue:notifications
     → return MeetingSchedule

   respondMeeting(userId, matchId, input: RespondMeetingInput)
     → verify user is OTHER participant (not proposer)
     → update Redis meeting record status
     → if CONFIRMED: notify proposer
     → return updated MeetingSchedule

   getMeetings(userId, matchId)
     → verify participant
     → fetch from Redis
     → return MeetingSchedule[]

2. Write service.test.ts BEFORE implementing:
   - createVideoRoom: non-participant rejected
   - createVideoRoom: SYSTEM message appended to chat
   - createVideoRoom: mock room URL contains 'mock-room'
   - scheduleMeeting: stored in Redis with correct TTL
   - respondMeeting: non-participant cannot respond

3. router.ts:
   POST /video/rooms              → createVideoRoom (authenticate())
   DELETE /video/rooms/:roomName  → endVideoRoom (authenticate())
   POST /video/meetings           → scheduleMeeting (authenticate())
   PUT  /video/meetings/:matchId  → respondMeeting (authenticate())
   GET  /video/meetings/:matchId  → getMeetings (authenticate())

4. VideoCall.client.tsx — 'use client':
   - "Start Video Call" button (Teal #0E7C7B, min-h-[44px])
   - On click: POST /api/v1/video/rooms → get roomUrl
   - Opens roomUrl in new tab (Daily.co iframe embed in future)
   - "Schedule Call" button → opens time picker modal
   - Shows upcoming scheduled meetings for this match
   - Add to chat/[matchId]/page.tsx above ChatInput

5. pnpm type-check && pnpm --filter @smartshaadi/api test
6. Commit: feat(video): daily.co room creation + meeting scheduler + video UI

─── TEAMMATE 2: escrow-dispute ───────────────────────────────────────────
Domain: apps/api/src/payments/ (extend existing) + apps/api/src/admin/
Files you OWN:
  - apps/api/src/payments/dispute.ts              (CREATE)
  - apps/api/src/payments/__tests__/dispute.test.ts (CREATE)
  - apps/api/src/admin/escrow.ts                  (CREATE)
  - apps/web/src/app/(app)/bookings/[id]/dispute/page.tsx (CREATE)
  - apps/web/src/app/(app)/admin/escrow/page.tsx  (CREATE)

Context — read first:
  - apps/api/src/payments/service.ts (existing payment flow)
  - apps/api/src/payments/router.ts  (existing routes — do NOT modify)
  - apps/api/src/jobs/escrowReleaseJob.ts
  - packages/db/schema/index.ts (escrow_accounts, bookings, audit_logs)
  - ARCHITECTURE.md Escrow Payment Flow section
  - packages/schemas/src/rental.ts (DisputeEscrowSchema)

Tasks in order:
1. dispute.ts — dispute state machine:
   raiseDispute(userId, bookingId, input: DisputeEscrowInput)
     → verify userId is customer of booking
     → verify booking status is CONFIRMED or COMPLETED
     → verify escrowAccount exists and status is HELD
     → update bookings.status → DISPUTED
     → update escrowAccounts.status → DISPUTED
     → cancel any pending Bull escrow-release job for this booking
       (use Bull job ID pattern: escrow-release:{bookingId})
     → append audit_log: DISPUTE_RAISED (hash-chained)
     → push Bull job to queue:notifications:
       notify vendor: "A dispute has been raised for booking {bookingId}"
       notify admin: "New dispute requires review"
     → return { success: true, bookingId, status: 'DISPUTED' }

   resolveDispute(adminUserId, bookingId, resolution: 'RELEASE' | 'REFUND' | 'SPLIT', splitRatio?: number)
     → verify adminUserId has ADMIN role
     → verify booking status is DISPUTED
     → if RELEASE: call transferToVendor() → escrow RELEASED → audit_log
     → if REFUND: call createRefund() → payment REFUNDED → audit_log
     → if SPLIT: release splitRatio% to vendor, refund rest → two audit_logs
     → update booking status → COMPLETED (RELEASE/SPLIT) or CANCELLED (REFUND)
     → notify both customer and vendor of resolution
     → return { success: true, resolution, amounts: { vendor, customer } }

   getDisputedBookings(adminUserId)
     → verify ADMIN role
     → fetch all bookings with status DISPUTED
     → join escrowAccounts, payments, users
     → return dispute queue

2. Write dispute.test.ts:
   - raiseDispute: non-customer rejected
   - raiseDispute: non-HELD escrow rejected
   - raiseDispute: audit log appended correctly
   - resolveDispute: non-admin rejected
   - resolveDispute RELEASE: escrow transferred, status RELEASED
   - resolveDispute REFUND: payment refunded, booking CANCELLED
   - resolveDispute SPLIT: correct amounts calculated

3. admin/escrow.ts — admin dispute endpoints:
   GET  /admin/disputes           → getDisputedBookings (ADMIN only)
   PUT  /admin/disputes/:bookingId/resolve → resolveDispute (ADMIN only)

4. Add dispute endpoint to payments router:
   Wait — do NOT modify payments/router.ts (owned by Phase 1 teammate).
   Instead add to a new file: apps/api/src/payments/disputeRouter.ts
   POST /payments/:bookingId/dispute → raiseDispute (authenticate())

5. Web pages:
   bookings/[id]/dispute/page.tsx:
   - "Raise Dispute" form with reason textarea
   - Warning: "Disputes freeze your escrow payment until resolved"
   - Submit → POST /api/v1/payments/:id/dispute
   - On success → redirect to /bookings/:id with DISPUTED badge

   admin/escrow/page.tsx (ADMIN only):
   - Dispute queue table: booking ID, customer, vendor, amount, raised date
   - Each row: Resolve dropdown (Release | Refund | Split 50/50)
   - Split: shows amount going to each party
   - Confirm button → PUT /admin/disputes/:id/resolve

6. pnpm type-check && pnpm --filter @smartshaadi/api test
7. Commit: feat(escrow): dispute state machine + admin resolution + dispute UI

─── TEAMMATE 3: rental-catalogue ─────────────────────────────────────────
Domain: apps/api/src/rentals/ + apps/web rental pages
Files you OWN:
  - apps/api/src/rentals/service.ts              (CREATE)
  - apps/api/src/rentals/router.ts               (CREATE)
  - apps/api/src/rentals/__tests__/service.test.ts (CREATE)
  - apps/web/src/app/(app)/rentals/page.tsx      (CREATE)
  - apps/web/src/app/(app)/rentals/[id]/page.tsx (CREATE)
  - apps/web/src/components/rental/RentalCard.tsx (CREATE)

Context — read first:
  - packages/db/schema/index.ts (rental_items, rental_bookings tables)
  - packages/types/src/rental.ts
  - packages/schemas/src/rental.ts
  - apps/api/src/vendors/service.ts (reference for vendor ownership pattern)
  - apps/api/src/auth/middleware.ts
  - .claude/commands/ui-component.md (design system)

Tasks in order:
1. service.ts:
   listRentalItems(query: RentalListQuery)
     → filter by: category, vendorId
     → if fromDate + toDate provided:
       exclude items where quantity is fully booked in that range
       (count active rentalBookings for item in date range)
     → return paginated RentalItem[] with meta

   getRentalItem(itemId)
     → fetch rental_items row
     → return RentalItem

   createRentalItem(vendorId, userId, input: CreateRentalItemInput)
     → verify userId has VENDOR role
     → verify vendors.userId === userId (own vendor only)
     → insert rental_items row
     → return created item

   createRentalBooking(userId, input: CreateRentalBookingInput)
     → verify item is active
     → verify fromDate < toDate
     → verify quantity available in date range:
       existing active bookings quantity sum < item.stockQty
     → calculate totalAmount:
       days = (toDate - fromDate) in days
       totalAmount = days × pricePerDay × quantity
     → insert rental_bookings row status=PENDING
     → return RentalBookingSummary

   confirmRentalBooking(vendorId, rentalBookingId)
     → verify vendor owns the rental item
     → update status PENDING → CONFIRMED
     → return updated booking

   returnRentalItem(vendorId, rentalBookingId)
     → verify ownership
     → update status ACTIVE → RETURNED
     → return updated booking

   getMyRentalBookings(userId)
     → fetch customer's rental bookings
     → join rental_items for item name
     → return RentalBookingSummary[]

2. Write service.test.ts BEFORE implementing:
   - listRentalItems: category filter works
   - listRentalItems: date availability filter excludes fully booked
   - createRentalBooking: date conflict detection works
   - createRentalBooking: totalAmount calculated correctly
   - createRentalItem: non-vendor rejected
   - confirmRentalBooking: wrong vendor rejected

3. router.ts:
   GET  /rentals              → listRentalItems (public — no auth)
   GET  /rentals/:id          → getRentalItem (public)
   POST /rentals              → createRentalItem (authenticate(), VENDOR)
   POST /rentals/:id/book     → createRentalBooking (authenticate())
   PUT  /rentals/bookings/:id/confirm → confirmRentalBooking (authenticate())
   PUT  /rentals/bookings/:id/return  → returnRentalItem (authenticate())
   GET  /rentals/bookings/mine        → getMyRentalBookings (authenticate())

4. Web pages:
   rentals/page.tsx — Server Component:
   - Category filter tabs: All | Decor | Costume | AV | Furniture | Lighting
   - Date range picker (fromDate, toDate) — Client Component
   - RentalCard grid: 2 cols mobile, 3 cols desktop
   - Price per day in ₹

   rentals/[id]/page.tsx — Server Component:
   - Item detail: name, category, description, price/day, deposit
   - Availability calendar (simple — show booked dates as gray)
   - "Book Now" form: fromDate, toDate, quantity
   - Total price calculator (live update on date change)
   - Submit → POST /api/v1/rentals/:id/book

   RentalCard.tsx:
   - Item name (Burgundy #7B2D42)
   - Category badge (Gold #C5A47E)
   - ₹X per day
   - Availability indicator: "Available" (Teal) | "Limited" (amber)
   - "View & Book" CTA (Teal #0E7C7B, min-h-[44px])
   - Ivory #FEFAF6 card background

5. Add "Rentals" to AppNav for INDIVIDUAL role

6. pnpm type-check && pnpm --filter @smartshaadi/api test
7. Commit: feat(rentals): rental catalogue + availability + booking + rental UI

─── SHARED RULES ─────────────────────────────────────────────────────────
- Never touch a file owned by another teammate
- index.ts: single agent mounts all routers in Phase 3
- USE_MOCK_SERVICES=true — mock Daily.co and Razorpay always
- Audit logs APPEND-ONLY — never UPDATE or DELETE audit_logs rows
- /compact when context hits 70%
- Mark task complete immediately after commit
```

---

## ─── PHASE 2: Integration (15:00–17:00) ────────────────────────────────

> Single agent. Shut team down first.

### Phase 2 single agent prompt
```
Read docs/superpowers/plans/2026-week7-video-escrow-rental-agent-teams.md
Phase 2 tasks — single agent only:

1. Mount all new routers in apps/api/src/index.ts:
   import { videoRouter }   from './video/router.js'
   import { disputeRouter } from './payments/disputeRouter.js'
   import { rentalRouter }  from './rentals/router.js'
   import { escrowAdminRouter } from './admin/escrow.js'

   app.use('/api/v1/video',    videoRouter)
   app.use('/api/v1/payments', disputeRouter)   // adds /:bookingId/dispute
   app.use('/api/v1/rentals',  rentalRouter)
   app.use('/api/v1/admin',    escrowAdminRouter)

2. Add "Rentals" link to (app)/layout.tsx navigation if not done by teammate.

3. Wire VideoCall button to chat page:
   Confirm VideoCall.client.tsx is imported in chat/[matchId]/page.tsx
   If not — add import and render above ChatInput.

4. Smoke test all new endpoints programmatically:
   Get session token → curl every new endpoint → report pass/fail.

   Video:
   □ POST /api/v1/video/rooms → 201, mock room URL returned
   □ POST /api/v1/video/meetings → 201, meeting scheduled
   □ GET  /api/v1/video/meetings/:matchId → 200

   Escrow dispute:
   □ POST /api/v1/payments/:bookingId/dispute → needs CONFIRMED booking
   □ GET  /api/v1/admin/disputes → 200 (as ADMIN role)

   Rentals:
   □ GET  /api/v1/rentals → 200, paginated list
   □ POST /api/v1/rentals → 201, item created (as VENDOR)
   □ POST /api/v1/rentals/:id/book → 201, booking created
   □ GET  /api/v1/rentals/bookings/mine → 200

   Web:
   □ /rentals page loads
   □ /rentals/:id page loads
   □ /bookings/:id/dispute page loads
   □ /admin/escrow page loads (as ADMIN)
   □ VideoCall button visible on chat page

5. pnpm type-check && pnpm test  (205/205 minimum)

6. Document results: docs/smoke-test-week7.md

7. git add -A
   git commit -m "feat(video,escrow,rentals): week 7 integration — all routers mounted"
   git push
```

---

## ─── Session End (17:30–18:00) ──────────────────────────────────────────

```bash
pnpm type-check && pnpm test

git add -A
git commit -m "chore: week 7 complete — video calls + escrow dispute + rental catalogue"
git push
```

Update ROADMAP.md:
```
✅ In-platform video calls (Daily.co mocked)
✅ Meeting scheduler (slot proposal, confirmation)
✅ Escrow dispute system (raise, admin resolve, audit log)
✅ Rental catalogue (decor, costumes, AV)
✅ Rental booking (date-range, quantity, availability check)
```

Add blockers:
```
[2026-week7] Daily.co API key needed — swap USE_MOCK=false after account setup
[2026-week7] Escrow SPLIT resolution needs Razorpay partial transfer API
[2026-week7] Return tracking (ACTIVE → RETURNED) needs vendor action flow
```

Update CLAUDE.md:
```
Phase:  2
Week:   8
Focus:  Pre-Wedding Ceremonies + Muhurat + Firebase Push + E2E QA
Status: Starting
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `packages/db/schema/index.ts` (rental+ceremonies) | Single agent | Phase 0 |
| `packages/types/src/video.ts + rental.ts` | Single agent | Phase 0 |
| `packages/schemas/src/video.ts + rental.ts` | Single agent | Phase 0 |
| `apps/api/src/lib/dailyco.ts` | Single agent | Phase 0 |
| `video/service.ts + router.ts` | Teammate 1 | Phase 1 |
| `chat/[matchId]/VideoCall.client.tsx` | Teammate 1 | Phase 1 |
| `payments/dispute.ts + disputeRouter.ts` | Teammate 2 | Phase 1 |
| `admin/escrow.ts` | Teammate 2 | Phase 1 |
| `web/app/(app)/bookings/[id]/dispute/` | Teammate 2 | Phase 1 |
| `web/app/(app)/admin/escrow/` | Teammate 2 | Phase 1 |
| `rentals/service.ts + router.ts` | Teammate 3 | Phase 1 |
| `web/app/(app)/rentals/` | Teammate 3 | Phase 1 |
| `web/components/rental/RentalCard.tsx` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Single agent | Phase 2 only |

---

## Dependency Chain

```
Phase 0 (single agent)
  └── schema migrated + types + schemas + dailyco mock committed
        ├── Teammate 1 (video-calls) — independent, starts immediately
        ├── Teammate 2 (escrow-dispute) — reads existing payments/service.ts
        │   NOTE: Teammate 2 reads but does NOT modify payments/router.ts
        │   Creates new disputeRouter.ts instead
        └── Teammate 3 (rental-catalogue) — independent, starts immediately
```

---

## Test Coverage Requirements

| Module | Required | Key Cases |
|--------|----------|-----------|
| `video/service.ts` | 80%+ | Non-participant rejected, SYSTEM message appended |
| `payments/dispute.ts` | 90%+ | Non-customer rejected, audit log chain, admin resolve |
| `rentals/service.ts` | 85%+ | Date conflict detection, availability filter, totalAmount |
| Rental + dispute UI | Visual | 375px mobile, 44px targets, Ivory bg |

---

## WSL Agent Teams Rules

```
✅ No plan approval — plan in 3 lines then implement
✅ If teammate goes idle — respawn: "claim your tasks, no plan mode"
✅ index.ts single agent only in Phase 2
✅ Restart API server after Phase 2 mounts (tsx watch unreliable on WSL DrvFs)
✅ 3 teammates max on Max 5x budget
✅ /compact at 70% context
```
