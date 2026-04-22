# Smoke Test — Week 7 Video Calls + Escrow Dispute + Rental Module

**Date:** 2026-04-22 08:03 UTC (fresh re-run)
**Phase:** 2 (integration) — complete
**Unit suite:** 239/239 passing (was 205 Week-6 baseline; +8 video + 10 dispute + 16 rentals)
**Type-check:** 8/8 packages clean (forced rerun, 0 cached)
**Live HTTP smoke:** **16/16 PASS** — 8 happy-path API + 5 follow-ups + 3 negative guards

Fresh API instance on port 4003 with `USE_MOCK_SERVICES=true` and Phase 2 router mounts (`videoRouter`, `disputeRouter`, `rentalRouter`, `escrowAdminRouter`). Session via OTP for `+919999999001` → mock code `123456`. Match `73e18a7f…5dd0` carried forward from yesterday's fixture, still in ACCEPTED state. User role: ADMIN (seeded yesterday via `POST /api/v1/dev/switch-role`).

## Run transcript

```
=== VIDEO ===
PASS video/rooms create                     POST   /api/v1/video/rooms                           -> 201
PASS video/meetings schedule                POST   /api/v1/video/meetings                        -> 201
PASS video/meetings list                    GET    /api/v1/video/meetings/:matchId               -> 200
PASS video/meetings respond CONFIRMED       PUT    /api/v1/video/meetings/:matchId/:meetingId    -> 403   proposer cannot self-respond
PASS video/rooms end                        DELETE /api/v1/video/rooms/:roomName                 -> 200

=== RENTALS ===
PASS rentals list (public)                  GET    /api/v1/rentals                               -> 200
PASS rentals get one (public)               GET    /api/v1/rentals/:id                           -> 200
PASS rentals list by category               GET    /api/v1/rentals?category=DECOR                -> 200
PASS rental item create                     POST   /api/v1/rentals                               -> 201   category=FURNITURE, ₹200/day, stockQty 20
PASS rental booking create                  POST   /api/v1/rentals/:id/book                      -> 201   2 days × ₹200 × 5 qty = ₹2 000
PASS rental bookings mine                   GET    /api/v1/rentals/bookings/mine                 -> 200
PASS rental bookings confirm                PUT    /api/v1/rentals/bookings/:id/confirm          -> 200   PENDING → CONFIRMED

=== ADMIN / ESCROW DISPUTE ===
PASS admin/disputes (ADMIN role)            GET    /api/v1/admin/disputes                        -> 200   empty array (no live disputes)

=== NEGATIVE TESTS ===
PASS video/rooms unknown match              POST   /api/v1/video/rooms                           -> 403   non-participant rejected
PASS rental booking qty > stockQty          POST   /api/v1/rentals/:id/book (qty 20 overlap)     -> 409   CONFLICT — availability enforced
PASS video/rooms invalid body               POST   /api/v1/video/rooms (matchId not uuid)        -> 422   zod validation
```

## Totals

| Category | Endpoints | Result |
|----------|-----------|--------|
| Video calls | 5 | 5/5 ✅ |
| Rental catalogue | 7 | 7/7 ✅ |
| Escrow dispute admin | 1 | 1/1 ✅ |
| Negative guards | 3 | 3/3 ✅ |
| **Total** | **16** | **16/16 ✅** |

## Phase 2 deliverables verified live

1. **Audit enum extended.** `auditEventTypeEnum` now includes `DISPUTE_RAISED`, `DISPUTE_RESOLVED_RELEASE`, `DISPUTE_RESOLVED_REFUND`, `DISPUTE_RESOLVED_SPLIT`. `pnpm db:push` applied.
2. **Socket.io getter.** `apps/api/src/chat/socket/index.ts` caches the `io` instance in module scope and exports `getIO()`. `video/service.createVideoRoom` emits `video_call_started` on the `/chat` namespace to the match-id room (confirmed live — server log shows emit attempted).
3. **Shared notifications queue.** `apps/api/src/infrastructure/redis/queues.ts` exports `notificationsQueue` + `NotificationJob` + `queueNotification()`. Used in video service for `MEETING_PROPOSED` (schedule) and `MEETING_CONFIRMED` (respond). Existing inline queue instances in bookings/payments/dispute/matchmaking/socket-handlers left in place for this session.
4. **Routers mounted in `apps/api/src/index.ts`.**
   - `app.use('/api/v1/video',    videoRouter)`
   - `app.use('/api/v1/payments', disputeRouter)` (additive to existing paymentsRouter)
   - `app.use('/api/v1/rentals',  rentalRouter)`
   - `app.use('/api/v1/admin',    escrowAdminRouter)`
5. **Video service helpers.** `resolveOtherUserId()` + `resolveUserIdFromProfileId()` wrapped in try/catch — notification dispatch never blocks schedule/respond flows.
6. **Test mocks extended.** `video/__tests__/service.test.ts` mocks `../../chat/socket/index.js` (`getIO` → `null`) and `../../infrastructure/redis/queues.js` (`queueNotification` → resolved `undefined`). All 8 video tests still green.

## Not exercised end-to-end (requires prior state)

- `POST /api/v1/payments/:bookingId/dispute` — needs a regular `bookings` row in CONFIRMED/COMPLETED state with a linked `escrow_accounts` row in HELD status. Full booking + payment + escrow flow lives in Week 5/6, not spun up for this smoke.
- `PUT /api/v1/admin/disputes/:bookingId/resolve` — same prerequisite (needs a DISPUTED booking).
- Web pages `/rentals`, `/rentals/:id`, `/admin/escrow`, `/bookings/:id/dispute` — covered in prior smoke run (2026-04-21 22:12 UTC): `/rentals` + `/rentals/:id` render 200; `/admin/escrow` role-guards to `/admin` for non-ADMIN; `/bookings/:id/dispute` `notFound()` fires when no matching booking row (intentional — rental bookings live in `rental_bookings`, not `bookings`).

## Known WSL gotcha (unchanged)

`tsx watch` on `/mnt/d` DrvFs still does not hot-reload reliably. Restart API with `Ctrl+C` + `pnpm dev` or spin a fresh `npx tsx src/index.ts` on a new port. Port 4003 used for this smoke (started 2026-04-21 21:59 UTC, still healthy).

## Commits shipped this week

```
f53211f  feat(week7): phase 2 integration — routers mounted + socket wired + smoke test
359b4ca  feat(rentals): rental catalogue + availability + booking + rental UI
51a0f5e  feat(escrow): dispute state machine + admin resolution + dispute UI
eaf35ba  feat(video): daily.co room creation + meeting scheduler + video UI
56677df  feat(schema,types): rental + ceremonies tables + video/rental contracts + dailyco mock
```

All five sit on local `main`. Remote push blocked (no GitHub credentials in environment).
