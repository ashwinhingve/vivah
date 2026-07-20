# Week 8 — Hardening Sprint + Ceremonies + Muhurat: Agent Teams Plan
# VivahOS Infinity · Phase 2 · Days 11–15
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1) → Single Agent (Phase 2)

> Week 8 fixes 8 P0 race conditions and correctness bugs from the Week 7 audit,
> adds pre-wedding ceremony modules and Muhurat selector, and leaves Week 9
> clean for Firebase push + Phase 2 QA + production deploy.
> No plan approval. Teammates plan in 3 lines then implement immediately.
> Each teammate owns exactly one domain — zero file overlap.

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Confirm status
cat CLAUDE.md | head -30

# 2. Week target
grep -A15 "Week 8" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 2 | Week: 8 | Focus: Hardening + Ceremonies + Muhurat | Status: Starting

# 4. Infrastructure
docker compose up -d
pnpm dev

# 5. Confirm test baseline
pnpm --filter @smartshaadi/api test 2>&1 | tail -3
# Must show 239/239 before any fixes land
```

---

## ─── PHASE 0: Single Agent (8:00–9:00) ──────────────────────────────────

> Add ceremonies to wedding types/schemas + confirm no schema changes needed.
> Commit before teammates spawn.

### Research prompt (8:00–8:15)

```
Read these files fully before touching anything:
- packages/db/schema/index.ts (ceremonies table — already exists from Week 7)
- packages/types/src/wedding.ts (what wedding types exist)
- packages/schemas/src/wedding.ts (what wedding schemas exist)
- apps/api/src/weddings/service.ts (what wedding endpoints exist)
- apps/api/src/weddings/router.ts (what routes are mounted)
- apps/api/src/video/service.ts (full file — understand current implementation)
- apps/api/src/payments/dispute.ts (full file)
- apps/api/src/rentals/service.ts (full file)
- apps/api/src/bookings/service.ts lines 30-60 (escrow queue setup)

Confirm:
1. ceremonies table exists in schema (from Week 7 Phase 0)
2. What ceremony types are missing from packages/types/src/wedding.ts
3. What the escrowReleaseQueue.add() call looks like — does it set jobId?

Do NOT write any code. Report findings.
```

### Phase 0 jobs (8:15–9:00)

#### Job 1 — Add ceremony types to wedding.ts if missing
Add to `packages/types/src/wedding.ts`:
```typescript
export const CeremonyType = {
  HALDI:       'HALDI',
  MEHNDI:      'MEHNDI',
  SANGEET:     'SANGEET',
  WEDDING:     'WEDDING',
  RECEPTION:   'RECEPTION',
  ENGAGEMENT:  'ENGAGEMENT',
  OTHER:       'OTHER',
} as const
export type CeremonyType = typeof CeremonyType[keyof typeof CeremonyType]

export interface Ceremony {
  id:        string
  weddingId: string
  type:      CeremonyType
  date:      string | null
  venue:     string | null
  startTime: string | null
  endTime:   string | null
  notes:     string | null
}

export interface MuhuratDate {
  date:     string
  muhurat:  string
  tithi:    string | null
  selected: boolean
}
```

#### Job 2 — Add ceremony + muhurat schemas if missing
Add to `packages/schemas/src/wedding.ts`:
```typescript
export const CreateCeremonySchema = z.object({
  type:      z.enum(['HALDI','MEHNDI','SANGEET','WEDDING','RECEPTION','ENGAGEMENT','OTHER']),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  venue:     z.string().max(255).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes:     z.string().max(1000).optional(),
})

export const UpdateCeremonySchema = CreateCeremonySchema.partial()

export const SelectMuhuratSchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  muhurat: z.string().min(1).max(100),
  tithi:   z.string().max(100).optional(),
})

export type CreateCeremonyInput = z.infer<typeof CreateCeremonySchema>
export type UpdateCeremonyInput = z.infer<typeof UpdateCeremonySchema>
export type SelectMuhuratInput  = z.infer<typeof SelectMuhuratSchema>
```

#### Job 3 — Fix escrow queue producer to use deterministic jobId
This is a single-line fix but must happen in Phase 0 because Teammate 2
reads this file as context.

In `apps/api/src/bookings/service.ts`, find the `escrowReleaseQueue.add()` call.
Change from:
```typescript
await escrowReleaseQueue.add('release', jobData, { delay: 48 * 60 * 60 * 1000 })
```
To:
```typescript
await escrowReleaseQueue.add('release', jobData, {
  delay: 48 * 60 * 60 * 1000,
  jobId: `escrow-release:${bookingId}`,  // deterministic — enables cancel by ID
})
```

#### Phase 0 commit (9:00)
```bash
pnpm --filter @smartshaadi/types build
pnpm --filter @smartshaadi/schemas build
pnpm type-check   # zero errors required
pnpm --filter @smartshaadi/api test  # 239/239 still passing
git add -A
git commit -m "fix(phase0-week8): ceremony types + muhurat schema + deterministic escrow jobId"
git push
```

> ✅ STOP. Agent Team takes over.

---

## ─── PHASE 1: Agent Team — P0 Fixes + Ceremonies (9:00–14:00) ──────────

> 3 teammates. No plan approval. Plan in 3 lines then implement.
> Each teammate writes failing tests FIRST, then fixes until green.

### Team spawn prompt

```
Week 8 hardening sprint for VivahOS Infinity.
Phase 0 committed: ceremony types + muhurat schemas + deterministic escrow jobId.

This week fixes P0 race conditions and correctness bugs from the Week 7 audit.
Every P0 fix must have a test that FAILS before the fix and PASSES after.
TDD is mandatory this week — not optional.

Create an agent team with exactly 3 teammates.
NO plan approval. Each teammate writes a 3-line plan then implements immediately.
index.ts NOT touched by any teammate.

─── TEAMMATE 1: video-hardening ──────────────────────────────────────────
Domain: apps/api/src/video/ (fix existing files only)
Files you OWN:
  - apps/api/src/video/service.ts              (MODIFY)
  - apps/api/src/video/router.ts               (MODIFY)
  - apps/api/src/video/__tests__/service.test.ts (MODIFY — add failing tests first)
  - apps/web/src/app/(chat)/[matchId]/VideoCall.client.tsx (MODIFY)

Context — read FULLY before touching anything:
  - apps/api/src/video/service.ts (current implementation)
  - apps/api/src/video/__tests__/service.test.ts (existing tests)
  - apps/api/src/lib/redis.ts (redis client)
  - packages/types/src/video.ts

P0 fixes in order (write failing test → implement fix → test passes):

FIX 1: Deterministic room storage in Redis
Problem: Room name `match-${matchId}` is generated but not stored.
On refresh the client loses the room name — two POSTs create two orphan rooms.

Fix in service.ts createVideoRoom():
  BEFORE calling dailyco.createRoom():
  → Check Redis key: room:active:{matchId}
  → If exists: return 409 ROOM_EXISTS error with existing roomUrl
  AFTER dailyco.createRoom() succeeds:
  → Store in Redis: SET room:active:{matchId} {roomName} EX {durationMin * 60}
  
Fix in service.ts endVideoRoom():
  → Lookup room name from Redis: GET room:active:{matchId}
  → Use that name for dailyco.deleteRoom()
  → Delete Redis key after: DEL room:active:{matchId}
  → Do NOT rely on client-sent roomName for deletion

Add GET /video/rooms/:matchId endpoint:
  → Return existing room if Redis key exists
  → Return 404 if no active room

Test cases (write BEFORE fixing):
  it('returns 409 if room already exists for match')
  it('stores room name in Redis on creation')
  it('returns existing room URL from Redis on GET')
  it('deletes Redis key on room end')
  it('uses Redis lookup not client roomName for deletion')

FIX 2: SCAN cursor loop for getMeetings
Problem: redis.scan(0,...) returns only first page — >100 meetings silently dropped.

Fix getMeetings() in service.ts:
  Replace single scan call with cursor loop:
  let cursor = '0'
  const keys: string[] = []
  do {
    const [nextCursor, batch] = await redis.scan(
      cursor, 'MATCH', `meeting:${matchId}:*`, 'COUNT', 100
    )
    cursor = nextCursor
    keys.push(...batch)
  } while (cursor !== '0')

Test cases:
  it('returns all meetings when >100 exist — SCAN cursor loop')
  (Mock redis.scan to return two pages)

FIX 3: respondMeeting status guard + matchId check
Problem: Already-CANCELLED meeting can flip back to CONFIRMED.
         Meeting ID guess exposes sibling matches.

Fix respondMeeting() in service.ts:
  → Fetch meeting from Redis first
  → If meeting.status !== 'PROPOSED' → throw INVALID_STATE error
  → If meeting.matchId !== matchId param → throw FORBIDDEN error
  → Only then update status

Fix router.ts PUT /video/meetings/:matchId:
  → Add Zod validation for input.status must be CONFIRMED or CANCELLED

Test cases:
  it('rejects respond on already-CANCELLED meeting')
  it('rejects respond with mismatched matchId')
  it('only PROPOSED meetings can be responded to')

FIX 4: Meeting TTL based on scheduledAt
Problem: Fixed 7-day TTL — meeting 30 days out expires before event.

Fix scheduleMeeting() in service.ts:
  → Calculate TTL: (scheduledAt timestamp - now) + 24h buffer
  → Minimum TTL: 24h (in case scheduledAt is very soon)
  → Maximum TTL: 31 days
  → Use calculated TTL instead of fixed 604800

Add Zod refinement to ScheduleMeetingSchema (in packages/schemas/src/video.ts):
  → scheduledAt must be > now + 5 minutes
  → scheduledAt must be < now + 30 days

FIX 5: Video UI proposer check
Problem: proposedBy is profileId but currentUserId is Better Auth userId.
         UI shows Confirm/Cancel to both parties.

Fix VideoCall.client.tsx:
  → Accept proposedByUserId prop (Better Auth id) not profileId
  → Or: API returns proposedByUserId alongside proposedBy
  → Standardise event name: use 'video_call_started' everywhere
    (service emits 'video_call_started', plan said 'VIDEO_CALL_STARTED')

After ALL fixes:
pnpm --filter @smartshaadi/api test  # must be >= 239 passing, zero failing
pnpm type-check
git commit -m "fix(video): P0 hardening — deterministic rooms + SCAN loop + status guards + TTL"

─── TEAMMATE 2: escrow-hardening ─────────────────────────────────────────
Domain: apps/api/src/payments/dispute.ts (fix existing file only)
Files you OWN:
  - apps/api/src/payments/dispute.ts              (MODIFY)
  - apps/api/src/payments/__tests__/dispute.test.ts (MODIFY — add failing tests first)
  - apps/web/src/app/(app)/admin/escrow/page.tsx  (MODIFY — lift resolved state)

Context — read FULLY before touching anything:
  - apps/api/src/payments/dispute.ts (current implementation)
  - apps/api/src/payments/__tests__/dispute.test.ts (existing tests)
  - apps/api/src/payments/service.ts (appendAuditLog helper)
  - apps/api/src/jobs/escrowReleaseJob.ts
  - packages/db/schema/index.ts (auditEventTypeEnum — now has DISPUTE_RAISED etc)

P0 fixes in order (write failing test → implement fix → test passes):

FIX 1: Bull job cancel by deterministic ID
Problem: dispute.ts scans getDelayed() — jobs in waiting/active are missed.
Phase 0 already fixed the producer to use jobId: `escrow-release:{bookingId}`.

Fix raiseDispute() in dispute.ts:
  Replace getDelayed() scan with:
  const job = await escrowReleaseQueue.getJob(`escrow-release:${bookingId}`)
  if (job) await job.remove()
  
Import escrowReleaseQueue — it's currently defined inline in bookings/service.ts.
Extract it to infrastructure/redis/queues.ts as a shared export:
  export const escrowReleaseQueue = new Queue('escrow-release', { connection: redisConnection })
Import from there in both bookings/service.ts and payments/dispute.ts.

Test cases (write BEFORE fixing):
  it('cancels escrow job by deterministic ID on dispute raise')
  it('proceeds even if no job exists (idempotent cancel)')

FIX 2: Optimistic locking on raiseDispute and resolveDispute
Problem: Two concurrent requests both pass status check → double-spend.

Fix raiseDispute():
  Replace two-step (check then update) with atomic conditional update:
  const updated = await db
    .update(bookings)
    .set({ status: 'DISPUTED', updatedAt: new Date() })
    .where(and(
      eq(bookings.id, bookingId),
      inArray(bookings.status, ['CONFIRMED', 'COMPLETED'])  // only if not already disputed
    ))
    .returning({ id: bookings.id })
  if (updated.length === 0) throw new Error('BOOKING_ALREADY_DISPUTED or invalid status')

Fix resolveDispute():
  Same pattern — atomic WHERE status = 'DISPUTED':
  const updated = await db
    .update(bookings)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'DISPUTED')))
    .returning({ id: bookings.id })
  if (updated.length === 0) throw new Error('DISPUTE_ALREADY_RESOLVED')

Test cases:
  it('second raiseDispute call on same booking returns error')
  it('second resolveDispute call returns DISPUTE_ALREADY_RESOLVED')

FIX 3: Transactional money movement
Problem: transferToVendor/createRefund runs outside DB transaction.
         Razorpay succeeds → DB throws → zombie state.

Fix resolveDispute() for RELEASE:
  Order: DB write FIRST, Razorpay SECOND
  1. db.transaction(): update escrow RELEASED + append audit log
  2. Only if DB commits: call transferToVendor()
  3. If Razorpay fails: log error + set escrow status RELEASE_PENDING
     (reconciliation job picks it up later — do NOT rollback DB)
  
Fix resolveDispute() for REFUND:
  Same pattern: DB write first, createRefund() second.
  If createRefund fails: set payment status REFUND_PENDING.

Add RELEASE_PENDING and REFUND_PENDING to escrowStatusEnum if not present:
  Check schema — if missing, add and run pnpm db:push.

Test cases:
  it('DB commits before Razorpay transfer call')
  it('Razorpay failure sets RELEASE_PENDING not reverts DB')
  it('REFUND: payment marked REFUND_PENDING on Razorpay failure')

FIX 4: Audit log enum swap
Problem: Code uses legacy ESCROW_DISPUTED/ESCROW_RELEASED — new enum values
         DISPUTE_RAISED/DISPUTE_RESOLVED_* return empty on queries.

Fix dispute.ts — replace ALL legacy audit event strings:
  ESCROW_DISPUTED  → DISPUTE_RAISED
  ESCROW_RELEASED  → DISPUTE_RESOLVED_RELEASE
  REFUND_ISSUED    → DISPUTE_RESOLVED_REFUND

Update test enum mock to include new values.

Test cases:
  it('audit log uses DISPUTE_RAISED not ESCROW_DISPUTED')
  it('audit log uses DISPUTE_RESOLVED_RELEASE on release')

FIX 5: SPLIT audit log chain
Problem: SPLIT writes two audit logs under different entityIds — chain breaks.

Fix resolveDispute() SPLIT:
  Both audit log entries use bookingId as entityId:
  First entry:  { eventType: 'DISPUTE_RESOLVED_SPLIT', entityId: bookingId, payload: { side: 'vendor', amount: vendorAmount } }
  Second entry: { eventType: 'DISPUTE_RESOLVED_SPLIT', entityId: bookingId, payload: { side: 'customer', amount: customerAmount } }

FIX 6: Admin UI resolved state lift
Fix apps/web/src/app/(app)/admin/escrow/page.tsx:
  → Remove separate /api/auth/me fetch for role check (rely on middleware)
  → Lift resolvedCount to React state — decrement on successful resolve
  → Show toast/confirmation after resolve instead of stale count

After ALL fixes:
pnpm --filter @smartshaadi/api test  # >= 239 passing
pnpm type-check
git commit -m "fix(escrow): P0 hardening — deterministic cancel + optimistic lock + transactional money + audit enum"

─── TEAMMATE 3: rental-hardening + ceremonies ────────────────────────────
Domain: apps/api/src/rentals/ + apps/api/src/weddings/ (ceremonies only)
Files you OWN:
  - apps/api/src/rentals/service.ts              (MODIFY)
  - apps/api/src/rentals/router.ts               (MODIFY)
  - apps/api/src/rentals/__tests__/service.test.ts (MODIFY)
  - apps/api/src/weddings/service.ts             (MODIFY — add ceremony + muhurat methods)
  - apps/api/src/weddings/router.ts              (MODIFY — add ceremony + muhurat routes)
  - apps/api/src/weddings/__tests__/service.test.ts (MODIFY — add ceremony tests)
  - apps/web/src/app/(app)/rentals/page.tsx      (MODIFY)
  - apps/web/src/app/(app)/rentals/[id]/page.tsx (MODIFY)
  - apps/web/src/app/(app)/rentals/bookings/mine/page.tsx (CREATE)

Context — read FULLY before touching anything:
  - apps/api/src/rentals/service.ts (current implementation)
  - apps/api/src/rentals/__tests__/service.test.ts (existing tests)
  - apps/api/src/weddings/service.ts (existing wedding methods)
  - packages/db/schema/index.ts (ceremonies, rental_items, rental_bookings)
  - packages/types/src/wedding.ts (Ceremony, MuhuratDate — added in Phase 0)
  - packages/schemas/src/wedding.ts (CreateCeremonySchema — added in Phase 0)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART A: Rental P0 Fixes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIX 1: Transactional booking to prevent overbooking
Problem: overlap check + insert are separate queries — two concurrent
         bookings for last unit both pass → overbooking.

Fix createRentalBooking() in service.ts:
  Wrap in Drizzle transaction with re-check inside:
  await db.transaction(async (tx) => {
    // Re-check availability inside transaction
    const reservedRows = await tx
      .select({ reserved: sql<number>`coalesce(sum(${rentalBookings.quantity}),0)::int` })
      .from(rentalBookings)
      .where(and(
        eq(rentalBookings.rentalItemId, input.rentalItemId),
        inArray(rentalBookings.status, ['PENDING','CONFIRMED','ACTIVE']),
        // date overlap check
        lte(rentalBookings.fromDate, input.toDate),
        gte(rentalBookings.toDate, input.fromDate),
      ))
    const reserved = reservedRows[0]?.reserved ?? 0
    if (reserved + input.quantity > item.stockQty) {
      throw new Error('ITEM_NO_LONGER_AVAILABLE')
    }
    // Insert inside same transaction
    const [booking] = await tx.insert(rentalBookings).values(bookingData).returning()
    return booking
  })

Test cases (write BEFORE fixing):
  it('prevents overbooking under concurrent requests — transaction test')
  it('throws ITEM_NO_LONGER_AVAILABLE when reserved inside tx')

FIX 2: Add ACTIVE transition endpoint
Problem: No CONFIRMED → ACTIVE endpoint — RETURNED state is permanently unreachable.

Add activateRentalBooking(vendorId, rentalBookingId) to service.ts:
  → verify vendor owns the rental item
  → update status CONFIRMED → ACTIVE
  → if status !== CONFIRMED → throw INVALID_STATE
  → return updated booking

Add to router.ts:
  PUT /rentals/bookings/:id/activate → activateRentalBooking (authenticate())

Test cases:
  it('activates CONFIRMED booking to ACTIVE')
  it('rejects activate on non-CONFIRMED booking')
  it('rejects activate by wrong vendor')

FIX 3: Rental availability display
Problem: listRentalItems shows raw stockQty — fully booked items show "Available".
         total count before availability filter makes pagination wrong.

Fix listRentalItems() in service.ts:
  After fetching items, for each item compute availableQty:
  → Count active bookings overlapping requested date range
  → availableQty = item.stockQty - reservedInRange
  → Add availableQty to returned RentalItem
  → Filter out items where availableQty <= 0 BEFORE counting total
  → meta.total reflects post-filter count

Add availableQty to RentalItem type in packages/types/src/rental.ts:
  availableQty: number  // stockQty minus reserved in requested range

Fix RentalCard.tsx and rentals/[id]/page.tsx:
  → Show "X available" not raw stockQty
  → If availableQty === 0 → show "Fully booked" badge, disable Book button

FIX 4: Public pages use plain fetch
Problem: rentals/page.tsx + rentals/[id]/page.tsx use fetchAuth which
         aborts with null for unauthenticated visitors → empty catalogue.

Fix both pages:
  → GET /api/v1/rentals → plain fetch (no auth header) — public browse
  → GET /api/v1/rentals/:id → plain fetch — public detail
  → POST /api/v1/rentals/:id/book → fetchAuth (requires auth)

FIX 5: /rentals/bookings/mine page missing
Problem: BookingForm redirects to /rentals/bookings/mine → 404.

Create apps/web/src/app/(app)/rentals/bookings/mine/page.tsx:
  Server Component.
  Fetch GET /api/v1/rentals/bookings/mine with auth cookie.
  Show list of customer's rental bookings:
  - Item name, dates, quantity, total amount, status badge
  - Status colours: PENDING=amber, CONFIRMED=teal, ACTIVE=green, RETURNED=gray
  - Empty state: "No rentals yet — browse our catalogue"
  - Link back to /rentals

FIX 6: confirmRentalBooking crash guard
Problem: 0-row UPDATE crashes on updated[0] without length check.

Fix confirmRentalBooking() in service.ts:
  After db.update().returning():
  if (updated.length === 0) {
    throw new Error('RENTAL_BOOKING_NOT_FOUND_OR_WRONG_VENDOR')
  }
  return updated[0]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART B: Pre-Wedding Ceremonies + Muhurat
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to apps/api/src/weddings/service.ts:

addCeremony(userId, weddingId, input: CreateCeremonyInput)
  → verify wedding ownership
  → insert ceremonies row
  → also update WeddingPlan.ceremonies array in MongoDB (keep in sync)
  → return Ceremony

updateCeremony(userId, weddingId, ceremonyId, input: UpdateCeremonyInput)
  → verify ownership
  → update ceremonies row
  → return updated Ceremony

deleteCeremony(userId, weddingId, ceremonyId)
  → verify ownership
  → delete ceremonies row

getCeremonies(userId, weddingId)
  → verify ownership
  → fetch all ceremonies for this wedding
  → return Ceremony[]

selectMuhurat(userId, weddingId, input: SelectMuhuratInput)
  → verify ownership
  → upsert WeddingPlan.muhuratDates in MongoDB:
    mark all others selected: false
    set matching date selected: true
  → also update weddings.weddingDate in PostgreSQL to the selected date
  → return updated MuhuratDate[]

getMuhuratSuggestions(weddingDate: string)
  → Generate 5 auspicious date suggestions near weddingDate
  → For Phase 2 (mock): return hardcoded auspicious dates
    based on day-of-week (Saturday/Sunday preferred in Indian tradition)
    with muhurat names: "Brahma Muhurat", "Vijay Muhurat" etc.
  → No LLM call — pure algorithmic for now
  → Return MuhuratDate[]

Add to apps/api/src/weddings/router.ts:
  GET  /weddings/:id/ceremonies           → getCeremonies (authenticate())
  POST /weddings/:id/ceremonies           → addCeremony (authenticate())
  PUT  /weddings/:id/ceremonies/:cId      → updateCeremony (authenticate())
  DELETE /weddings/:id/ceremonies/:cId    → deleteCeremony (authenticate())
  GET  /weddings/:id/muhurat              → getMuhuratSuggestions (authenticate())
  PUT  /weddings/:id/muhurat              → selectMuhurat (authenticate())

Add ceremony section to wedding UI:
Modify apps/web/src/app/(app)/weddings/[id]/page.tsx:
  Add "Ceremonies" tab alongside Overview | Tasks | Budget | Guests
  Show ceremony list: type badge, date, venue, time
  "Add Ceremony" button → inline form (type dropdown, date, venue, time)
  Each ceremony: edit + delete buttons

Add muhurat section to wedding overview:
  "Auspicious Dates" card showing 5 suggestions
  Selected muhurat highlighted in Gold #C5A47E
  "Select this date" button updates wedding date

Write tests:
  - addCeremony: creates PG row + updates MongoDB
  - getCeremonies: returns all for wedding, not others
  - selectMuhurat: marks correct date, deselects others
  - getMuhuratSuggestions: returns 5 dates

After ALL fixes:
pnpm --filter @smartshaadi/api test  # >= 239 passing
pnpm type-check
git commit -m "fix(rentals): P0 hardening — tx overbooking + ACTIVE + availability + public pages"
git commit -m "feat(ceremonies): pre-wedding ceremony modules + Muhurat date selector"

─── SHARED RULES ─────────────────────────────────────────────────────────
- Write FAILING test first — implement fix — test passes (TDD mandatory)
- Never touch a file owned by another teammate
- index.ts NOT touched by any teammate
- /compact when context hits 70%
- Mark task complete immediately after commit
- No plan approval — implement immediately
```

---

## ─── PHASE 2: Integration + Smoke (14:00–17:00) ────────────────────────

> Single agent. Shut team down first.

### Phase 2 single agent prompt
```
Week 8 Phase 2 integration. All teammate commits are in.

1. Mount new ceremony + muhurat routes:
   They were added to weddings/router.ts by Teammate 3 —
   confirm weddingRouter is already mounted in index.ts (from Week 6).
   If ceremony routes need a separate mount — add it.

2. Mount rental /bookings/mine page:
   Confirm /rentals/bookings/mine/page.tsx exists and is reachable.
   Test: curl http://localhost:3000/rentals/bookings/mine (with session)

3. Export escrowReleaseQueue from infrastructure/redis/queues.ts:
   Confirm Teammate 2's fix moved queue definition there.
   Confirm both bookings/service.ts and payments/dispute.ts import from there.
   If still duplicated — consolidate now.

4. Add RELEASE_PENDING + REFUND_PENDING to escrowStatusEnum if missing:
   Check packages/db/schema/index.ts escrowStatusEnum
   If missing → add and run pnpm db:push

5. Run full programmatic smoke test:
   Get session token. Curl every endpoint.

   Video (hardened):
   □ POST /api/v1/video/rooms → 201, room stored in Redis
   □ POST /api/v1/video/rooms (same matchId) → 409 ROOM_EXISTS
   □ GET  /api/v1/video/rooms/:matchId → 200, returns existing room
   □ DELETE /api/v1/video/rooms/:roomName → 200, Redis key deleted
   □ POST /api/v1/video/meetings → 201, TTL based on scheduledAt

   Escrow (hardened):
   □ POST /api/v1/payments/:bookingId/dispute → 200 (need CONFIRMED booking)
   □ POST /api/v1/payments/:bookingId/dispute (again) → 409 ALREADY_DISPUTED
   □ GET  /api/v1/admin/disputes → 200, list returned

   Rentals (hardened):
   □ GET  /api/v1/rentals → 200 (no auth needed — public)
   □ POST /api/v1/rentals/:id/book → 201, booking created
   □ PUT  /api/v1/rentals/bookings/:id/activate → 200 (as VENDOR)
   □ GET  /api/v1/rentals/bookings/mine → 200

   Ceremonies:
   □ GET  /api/v1/weddings/:id/ceremonies → 200
   □ POST /api/v1/weddings/:id/ceremonies → 201, HALDI created
   □ GET  /api/v1/weddings/:id/muhurat → 200, 5 dates returned
   □ PUT  /api/v1/weddings/:id/muhurat → 200, date selected

   Web:
   □ /rentals → loads without auth (public browse)
   □ /rentals/bookings/mine → loads with auth
   □ /weddings/:id → Ceremonies tab visible
   □ /admin/escrow → dispute queue loads

6. pnpm type-check && pnpm --filter @smartshaadi/api test
   Must be >= 239 + new tests from teammates (expect ~270+)

7. Document: docs/smoke-test-week8.md

8. git add -A
   git commit -m "fix(week8): phase 2 integration — all P0 fixes + ceremonies + muhurat wired"
   git push

Report: final test count + all smoke results.
```

---

## ─── Session End (17:30–18:00) ──────────────────────────────────────────

```bash
git add -A
git commit -m "chore: week 8 complete — hardening sprint + ceremonies + muhurat"
git push
```

Update ROADMAP.md:
```
✅ Pre-wedding ceremony modules: Haldi, Mehndi, Sangeet
✅ Muhurat date selector (integrated with wedding plan)
✅ Video call P0 fixes (deterministic rooms + SCAN loop + status guards)
✅ Escrow P0 fixes (optimistic locking + transactional money + audit enum)
✅ Rental P0 fixes (transaction + ACTIVE state + availability + public pages)
```

Update CLAUDE.md:
```
Phase:  2
Week:   9
Focus:  Firebase Push + Multi-Event + Phase 2 QA + Production Deploy
Status: Starting
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `packages/types/src/wedding.ts` (ceremony+muhurat) | Single agent | Phase 0 |
| `packages/schemas/src/wedding.ts` (ceremony+muhurat) | Single agent | Phase 0 |
| `apps/api/src/bookings/service.ts` (jobId fix) | Single agent | Phase 0 |
| `video/service.ts + router.ts` | Teammate 1 | Phase 1 |
| `video/__tests__/service.test.ts` | Teammate 1 | Phase 1 |
| `web/app/(chat)/[matchId]/VideoCall.client.tsx` | Teammate 1 | Phase 1 |
| `payments/dispute.ts` | Teammate 2 | Phase 1 |
| `payments/__tests__/dispute.test.ts` | Teammate 2 | Phase 1 |
| `web/app/(app)/admin/escrow/page.tsx` | Teammate 2 | Phase 1 |
| `rentals/service.ts + router.ts` | Teammate 3 | Phase 1 |
| `rentals/__tests__/service.test.ts` | Teammate 3 | Phase 1 |
| `weddings/service.ts` (ceremonies+muhurat) | Teammate 3 | Phase 1 |
| `weddings/router.ts` (ceremony routes) | Teammate 3 | Phase 1 |
| `web/app/(app)/rentals/` | Teammate 3 | Phase 1 |
| `web/app/(app)/weddings/[id]/page.tsx` (ceremonies tab) | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Single agent | Phase 2 only |

---

## Dependency Chain

```
Phase 0 (single agent)
  └── ceremony types + muhurat schemas + deterministic escrow jobId committed
        ├── Teammate 1 (video-hardening) — independent, starts immediately
        ├── Teammate 2 (escrow-hardening) — reads Phase 0 jobId fix as context
        └── Teammate 3 (rental-hardening + ceremonies) — independent
              └── Phase 2 single agent:
                    - Confirm mounts
                    - Consolidate escrowReleaseQueue export
                    - Full smoke test
```

---

## P0 Fix Verification Matrix

| Fix | Domain | Test Pattern | Race Covered |
|-----|--------|-------------|--------------|
| Deterministic room Redis storage | Video | 409 on duplicate POST | Double room creation |
| SCAN cursor loop | Video | Mock 2-page redis.scan | Meetings > 100 |
| respondMeeting status guard | Video | CANCELLED → CONFIRMED rejected | State flip |
| Meeting TTL from scheduledAt | Video | TTL = scheduledAt - now + 24h | Premature expiry |
| Bull cancel by jobId | Escrow | getJob().remove() called | Late job fire |
| Optimistic locking | Escrow | Second dispute → 409 | Double-spend |
| Transactional money movement | Escrow | DB commits before Razorpay | Zombie state |
| Audit enum swap | Escrow | DISPUTE_RAISED in log | Empty queries |
| Rental booking transaction | Rental | Concurrent booking rejected | Overbooking |
| ACTIVE transition | Rental | CONFIRMED → ACTIVE → RETURNED | Unreachable state |
| Availability display | Rental | availableQty in response | False "Available" |
| Public pages plain fetch | Rental | Unauthenticated GET → 200 | Empty catalogue |

---

## WSL Agent Teams Rules

```
✅ TDD mandatory — failing test first, fix second
✅ No plan approval — implement immediately after 3-line plan
✅ Restart API after Phase 2 mounts (tsx watch unreliable on WSL DrvFs)
✅ index.ts single agent only in Phase 2
✅ /compact at 70% context
✅ If teammate goes idle — respawn with task list, no plan mode
```
