# Smart Shaadi — Week 8 Smoke Test

**Date:** 2026-04-22
**Executor:** Claude Code (Opus 4.7 1M)
**Phase:** 2 / Week 8 — Hardening Sprint + Ceremonies + Muhurat
**API port:** 4000 (default)
**Web port:** 3000
**USE_MOCK_SERVICES:** true

---

## Setup

- `pnpm db:push` applied Week 8 schema changes — `escrow_status` now includes `RELEASE_PENDING`, `payment_status` now includes `REFUND_PENDING`. Verified via `SELECT enum_range(NULL::...)` on Postgres.
- `audit_event_type` enum contains `DISPUTE_RAISED`, `DISPUTE_RESOLVED_RELEASE`, `DISPUTE_RESOLVED_REFUND`, `DISPUTE_RESOLVED_SPLIT` (added earlier, confirmed present).
- API: `npx tsx src/index.ts` (PORT=4000)
- Web: `pnpm dev` (port 3000)
- Auth: OTP login for `+919999999001` — mock OTP `123456`. Session cookie `better-auth.session_token` captured in `/tmp/smoke-w8.cookies`.
- User role: ADMIN. Profile auto-created via `GET /profiles/me`. User is also vendor owner of `Smoke Rentals LLC`.

---

## Mount Verification

| Mount | File | Status |
|-------|------|--------|
| `/api/v1/weddings` → weddingRouter | `apps/api/src/index.ts:89` | Present from Week 6 |
| `/api/v1/video` → videoRouter | `apps/api/src/index.ts:91` | Present from Week 7 |
| `/api/v1/payments` → disputeRouter | `apps/api/src/index.ts:92` | Present from Week 7 |
| `/api/v1/rentals` → rentalRouter | `apps/api/src/index.ts:93` | Present from Week 7 |
| `/api/v1/admin` → escrowAdminRouter | `apps/api/src/index.ts:94` | Present from Week 7 |

No new mounts required in Phase 2 — all Week 8 routes live inside existing routers (ceremonies+muhurat in `weddings/router.ts`, `GET /video/rooms/:matchId` in `video/router.ts`, `PUT /rentals/bookings/:id/activate` in `rentals/router.ts`).

Route presence spot-checks:
- `GET /api/v1/weddings/:id/ceremonies` — 200
- `GET /api/v1/video/rooms/:matchId` — 200
- `apps/web/src/app/(app)/rentals/bookings/mine/page.tsx` — exists

---

## Smoke Matrix

### Video (hardened) — 5/5

| # | Endpoint | Expect | Got | Notes |
|---|----------|--------|-----|-------|
| 1 | `POST /api/v1/video/rooms` (first) | 201 | **201** | Room `mock-room-match-…` created, Redis key `room:active:{matchId}` set |
| 2 | `POST /api/v1/video/rooms` (duplicate) | 409 | **409** | Error `ROOM_EXISTS` with existing roomName in message |
| 3 | `GET /api/v1/video/rooms/:matchId` | 200 | **200** | Existing room returned from Redis lookup |
| 4 | `DELETE /api/v1/video/rooms/:roomName` | 200 | **200** | Body `{matchId}` required; Redis key cleaned |
| 5 | `POST /api/v1/video/meetings` | 201 | **201** | `scheduledAt = now+7d`, TTL calculated from scheduledAt |

### Escrow (hardened) — 2/2

| # | Endpoint | Expect | Got | Notes |
|---|----------|--------|-----|-------|
| 6 | `GET /api/v1/admin/disputes` | 200 | **200** | Dispute queue endpoint reachable as ADMIN |
| 7 | Audit enum swap | DISPUTE_* in source | **PASS** | `apps/api/src/payments/dispute.ts`: 7 references to `DISPUTE_RAISED`/`DISPUTE_RESOLVED_*`, 0 references to legacy `ESCROW_DISPUTED`/`ESCROW_RELEASED`/`REFUND_ISSUED`. Enum values confirmed in `audit_event_type` Postgres enum. |

> Note: No end-to-end dispute was raised this run — seed CONFIRMED booking is owned by `seed-individual-001`, not the ADMIN session user (`raiseDispute` checks `booking.customerId === userId`). Source-level + enum-level verification was sufficient for this smoke; dispute test coverage already exists in `apps/api/src/payments/__tests__/dispute.test.ts` (all green).

### Rentals (hardened) — 4/4

| # | Endpoint | Expect | Got | Notes |
|---|----------|--------|-----|-------|
| 8 | `GET /api/v1/rentals` (no auth) | 200 | **200** | Public browse. `availableQty:3` returned alongside `stockQty:3`. |
| 9 | `POST /api/v1/rentals/:id/book` | 201 | **201** | Booking `d8a3be0c…` created for Floral Mandap Set, fromDate 2026-05-22, toDate 2026-05-24, qty 1, `status:PENDING` |
| 10 | `PUT /api/v1/rentals/bookings/:id/activate` | 200 | **200** | After `/confirm` → `/activate`, `status:ACTIVE` |
| 11 | `GET /api/v1/rentals/bookings/mine` | 200 | **200** | Returns booking list with status badges (PENDING/CONFIRMED/ACTIVE) |

### Ceremonies + Muhurat — 4/4

| # | Endpoint | Expect | Got | Notes |
|---|----------|--------|-----|-------|
| 12 | `POST /api/v1/weddings/:id/ceremonies` | 201 | **201** | HALDI ceremony on 2026-12-13, venue Rooftop, 10:00–13:00 |
| 13 | `GET /api/v1/weddings/:id/ceremonies` | 200 | **200** | Returns 1 ceremony scoped to wedding |
| 14 | `GET /api/v1/weddings/:id/muhurat` | 200 | **200** | 5 dated suggestions: Brahma / Vijay / Abhijit / Amrit Siddhi / Sarvartha Siddhi, each with `tithi`, `selected:false` |
| 15 | `PUT /api/v1/weddings/:id/muhurat` | 200 | **200** | Date 2026-12-05 selected → `selected:true` in response |

### Web pages — 4/4

| Page | Expect | Got | Notes |
|------|--------|-----|-------|
| `/rentals` (no auth) | 200 | **200** | Public browse works (FIX A4) |
| `/rentals/bookings/mine` | 200 | **200** | New page renders (FIX A5) |
| `/weddings/:id` | 200 | **200** | Ceremonies + Muhurat markers present in HTML (Haldi ×4, Muhurat ×22, Auspicious ×2, Ceremony ×4) |
| `/admin/escrow` | 200 | **200** | Dispute queue page loads |

---

## Totals

- **API smoke:** 11/11 endpoints PASS
- **Ceremony + muhurat:** 4/4 PASS
- **Web pages:** 4/4 PASS
- **Tests:** 277 / 277 (Vitest, `pnpm --filter @smartshaadi/api test`)
- **Type-check:** 8 / 8 packages clean (`pnpm type-check --force`)

---

## Changes from Week 7

1. Phase 0: ceremony types + muhurat schemas added; deterministic `jobId: escrow-release:{bookingId}` on the producer.
2. Teammate 1 (video): deterministic Redis room storage, 409 on duplicate room create, `GET /rooms/:matchId`, SCAN cursor loop for `getMeetings`, status + matchId guards on `respondMeeting`, TTL calculated from scheduledAt, UI proposer check now resolves userId → profileId.
3. Teammate 2 (escrow): `escrowReleaseQueue` extracted to `apps/api/src/infrastructure/redis/queues.ts`; Bull job cancel by deterministic ID; atomic optimistic-locking updates on `raiseDispute`/`resolveDispute`; DB-commit-before-Razorpay with `RELEASE_PENDING`/`REFUND_PENDING` fallbacks; audit enum swap (DISPUTE_RAISED, DISPUTE_RESOLVED_*); admin UI resolved-count lifted to client state.
4. Teammate 3 (rentals + ceremonies): transactional overbook prevention, `PUT /activate`, `availableQty` in responses, public pages use plain `fetch`, `/rentals/bookings/mine` page, crash guard on `confirmRentalBooking`; wedding ceremonies CRUD + muhurat suggest/select; Ceremonies tab + Muhurat card on wedding overview.

---

## Observations

- **API 4000 vs 4003:** Week 7 doc used 4003 via explicit `PORT=` override. Web server's `server-fetch.ts` defaults `NEXT_PUBLIC_API_URL=http://localhost:4000`. For this smoke the API was run on the default 4000 so the web-server SSR fetch reaches it without env overrides.
- **Unhandled error on bad UUID:** `GET /api/v1/profiles/matches` (stray curl during smoke setup) threw Postgres `invalid input syntax for type uuid` and crashed the API process. Not in scope for Week 8 fixes — flag for Week 9 error-handler middleware work.
- **tsx watch on WSL DrvFs:** still unreliable. Restarted API with a fresh `npx tsx src/index.ts` for smoke — confirms the existing CLAUDE.md note.
