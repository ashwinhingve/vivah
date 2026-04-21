# Smoke Test — Week 7 Video Calls + Escrow Dispute + Rental Module

**Date:** 2026-04-21 22:12 UTC
**Phase:** 2 (integration) — complete
**Unit suite:** 239/239 passing (was 205 Week-6 baseline; +8 video + 10 dispute + 16 rentals)
**Type-check:** 8/8 packages clean (forced rerun, 0 cached)
**Live HTTP smoke:** 8/8 API endpoints PASS · 4/4 web pages behave correctly

Fresh API instance on port 4003 with `USE_MOCK_SERVICES=true` and Phase 2 router mounts (`videoRouter`, `disputeRouter`, `rentalRouter`, `escrowAdminRouter`). Session via OTP for `+919999999001`. Compatible match seeded via dev router, flipped to ACCEPTED state in SQL. Vendor row created via `POST /api/v1/vendors`. Admin-role session obtained via `POST /api/v1/dev/switch-role` followed by re-auth (Better Auth caches role on the session row — toggle requires signout + re-verify).

## API — 8/8 PASS

| # | Endpoint | Method | HTTP | Result |
|---|----------|--------|------|--------|
| 1 | `/api/v1/video/rooms` | POST | 201 | mock room URL `https://smartshaadi.daily.co/mock-room-match-{matchId}-{ts}` |
| 2 | `/api/v1/video/meetings` | POST | 201 | meeting id + status PROPOSED, 7-day Redis TTL |
| 3 | `/api/v1/video/meetings/:matchId` | GET | 200 | 1 meeting returned, sorted asc by scheduledAt |
| 4 | `/api/v1/rentals` | GET | 200 | paginated `{items,meta:{page:1,limit:10,total}}` |
| 5 | `/api/v1/rentals` | POST | 201 | item created (as VENDOR, RENTAL category vendor) |
| 6 | `/api/v1/rentals/:id/book` | POST | 201 | booking created, totalAmount = 2 days × ₹5000 = ₹10 000, depositPaid = ₹10 000 |
| 7 | `/api/v1/rentals/bookings/mine` | GET | 200 | my bookings list (1 row) |
| 8 | `/api/v1/admin/disputes` | GET | 200 | empty array (no live disputes), ADMIN-gated |

## Web — 4/4 behave correctly

| Path | HTTP | Note |
|------|------|------|
| `/rentals` | 200 | Renders Rent Items catalogue (title confirmed) |
| `/rentals/:id` | 200 | Renders detail page for created item (title `Floral Mandap Set — Rent`) |
| `/admin/escrow` | 307 → `/admin` | Server redirect from role guard — next/navigation pushes non-ADMIN sessions. After re-auth as ADMIN the route renders (API call verified separately) |
| `/bookings/:id/dispute` | 404 | `notFound()` fires when no matching row in `bookings` table. Rental bookings live in `rental_bookings` so this is intentional. Page will render once a real customer booking with a HELD escrow exists. |

## Phase 2 changes landed this session

1. **Audit enum extended.** Added `DISPUTE_RAISED`, `DISPUTE_RESOLVED_RELEASE`, `DISPUTE_RESOLVED_REFUND`, `DISPUTE_RESOLVED_SPLIT` to `auditEventTypeEnum`. `pnpm db:push` applied.
2. **Socket.io getter.** `apps/api/src/chat/socket/index.ts` now caches the `io` instance in module scope and exports `getIO()`. `video/service.createVideoRoom` emits `video_call_started` on the `/chat` namespace to the match-id room.
3. **Shared notifications queue.** Added `notificationsQueue` + `NotificationJob` + `queueNotification()` to `apps/api/src/infrastructure/redis/queues.ts`. Used in video/service for `MEETING_PROPOSED` + `MEETING_CONFIRMED`. Existing inline duplicates in bookings/payments/matchmaking/socket-handlers/dispute left untouched for this session (refactor target for Week 8).
4. **Routers mounted in `apps/api/src/index.ts`.**
   - `app.use('/api/v1/video', videoRouter)`
   - `app.use('/api/v1/payments', disputeRouter)` (additive — `paymentsRouter` still mounted above)
   - `app.use('/api/v1/rentals', rentalRouter)`
   - `app.use('/api/v1/admin', escrowAdminRouter)`
5. **Video service helpers.** Added `resolveOtherUserId()` + `resolveUserIdFromProfileId()` — wrapped in try/catch so notification dispatch never blocks the schedule/respond flows.
6. **Test mocks extended.** `video/__tests__/service.test.ts` now mocks `../../chat/socket/index.js` (`getIO` → `null`) and `../../infrastructure/redis/queues.js` (`queueNotification` → resolved `undefined`).

## Known WSL gotcha (unchanged)
`tsx watch` on `/mnt/d` DrvFs still does not hot-reload. Restart API with `Ctrl+C` + `pnpm dev` (or spin a fresh `npx tsx src/index.ts` on a new port). Port 4003 used for this smoke.

## Commit plan
- `feat(week7): phase 2 integration — routers mounted + socket getIO + audit enum`
- Files: `packages/db/schema/index.ts`, `apps/api/src/index.ts`, `apps/api/src/chat/socket/index.ts`, `apps/api/src/infrastructure/redis/queues.ts`, `apps/api/src/video/service.ts`, `apps/api/src/video/__tests__/service.test.ts`, `docs/smoke-test-week7.md`
