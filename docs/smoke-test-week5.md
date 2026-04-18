# Week 5 Phase 2 — Smoke Test Results

Date: 2026-04-18

## Checklist

### 1. Escrow Release Job
- [x] `escrowReleaseJob.ts` exists at `apps/api/src/jobs/escrowReleaseJob.ts`
- [x] Worker registered on `queue:escrow-release`
- [x] DISPUTED booking check present — blocks release
- [x] `transferToVendor()` called on non-disputed booking
- [x] `escrowAccounts.status` updated to `RELEASED` with `releasedAt`
- [x] `appendAuditLog` called with `ESCROW_RELEASED` event type
- [x] `registerEscrowReleaseWorker()` called in `apps/api/src/index.ts`

### 2. Router Mounts
- [x] `vendorsRouter` → `app.use('/api/v1/vendors', vendorsRouter)`
- [x] `bookingsRouter` → `app.use('/api/v1/bookings', bookingsRouter)`
- [x] `paymentsRouter` → `app.use('/api/v1/payments', paymentsRouter)`
- [x] Razorpay webhook raw-body handler mounted before `express.json()`
- [x] All three routers imported in `index.ts`

### 3. Customer Dashboard (`/dashboard`)
- [x] Ivory `#FEFAF6` background
- [x] Gold `#C5A47E` borders on stat cards
- [x] Teal `#0E7C7B` numbers
- [x] Burgundy `#7B2D42` headings
- [x] 4 stat cards: Active Matches, Bookings, Requests, Profile %
- [x] Fetches `/api/v1/bookings?role=customer` for live counts
- [x] Fetches `/api/v1/matchmaking/requests/received` for pending requests
- [x] Profile completeness bar renders when sections available
- [x] Mobile FAB present
- [x] Empty state for completeness < 40%

### 4. Vendor Dashboard (`/vendor-dashboard`)
- [x] 4 stat cards: Pending, Confirmed this month, Revenue, Rating
- [x] Fetches `/api/v1/bookings?role=vendor` for all vendor bookings
- [x] Computes stats from booking list (no dedicated stats endpoint needed)
- [x] `BookingQueueList.client.tsx` renders pending bookings
- [x] Confirm button → `PUT /api/v1/bookings/:id/confirm`
- [x] Decline button → `PUT /api/v1/bookings/:id/cancel`
- [x] Loading state per booking item
- [x] Upcoming events section (CONFIRMED bookings)
- [x] Empty state when no pending bookings

### 5. Admin Dashboard (`/admin`)
- [x] ADMIN role guard — `GET /api/auth/me` → `redirect('/dashboard')` if not ADMIN
- [x] 4 stat cards: Total Users, Pending KYC, Active Vendors, Bookings This Month
- [x] Pending KYC count live from `/api/v1/admin/kyc/pending`
- [x] `KycQueueTable.client.tsx` renders profileId, Aadhaar status, duplicate flag, submitted date
- [x] Approve → `PUT /api/v1/admin/kyc/:profileId/approve`
- [x] Reject → `PUT /api/v1/admin/kyc/:profileId/reject`
- [x] Approved/rejected rows removed from table immediately
- [x] Audit logs section (placeholder — endpoint planned for Week 6)

## Type-Check Results

```
apps/web   — 0 errors (tsc --noEmit)
apps/api   — 0 errors (tsc --noEmit)
packages/* — 0 errors (cached)
```

## Test Results

```
Test Files  17 passed (17)
Tests       182 passed (182)
```

Zero regressions from Week 5 Phase 1.

## Known Gaps (tracked for later)

| Gap | Location | Week |
|-----|----------|------|
| Total Users stat requires admin aggregation endpoint | admin/page.tsx | Week 6 |
| Active Vendors stat requires vendor aggregation endpoint | admin/page.tsx | Week 6 |
| Bookings This Month stat requires aggregation endpoint | admin/page.tsx | Week 6 |
| Average Rating requires reviews/ratings system | vendor-dashboard | Phase 2 |
| Audit logs endpoint for admin | admin/page.tsx | Week 6 |
