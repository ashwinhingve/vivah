# Phase 2 QA Report — 2026-04-22

Phase 2 spans Weeks 6–9. This audit verifies every Phase 2 feature is integrated and responding over HTTP at end of Week 9.

## Environment

- API: `apps/api/src/index.ts` on `http://localhost:4001` (USE_MOCK_SERVICES=true)
- Web: `apps/web` on `http://localhost:3003` (turbopack dev)
- Auth: Better Auth phone OTP (+919999999001, mock code 123456)
- User: role-switched via `POST /api/v1/dev/switch-role` + re-login

## Audit Results — 15 Phase 2 features

| # | Feature | Primary Endpoint | API | Web | Verdict |
|---|---------|------------------|-----|-----|---------|
| 1 | Wedding planning | `/api/v1/weddings` · `/weddings` | 200 | 200 | ✅ Working |
| 2 | Task board | `/weddings/:id/tasks` | 200 | 200 | ✅ Working |
| 3 | Budget tracker | `/weddings/:id/budget` (PUT only) · wedding detail includes budget | 200 (via detail) | 200 | ⚠️ Partial — no dedicated GET, web reads via wedding detail |
| 4 | Guest management | `/weddings/:id/guests` | 200 | 200 | ✅ Working |
| 5 | RSVP flow | `/rsvp/:token` (public PUT) | 404 on fake token (clean reject) | 404 | ⚠️ Partial — endpoint alive; not exercised with live invitation token |
| 6 | Video call rooms | `POST /api/v1/video/rooms` | 422 on fake body (correct Zod reject) | — | ⚠️ Partial — alive; real Daily.co cutover pending |
| 7 | Meeting scheduler | `GET /api/v1/video/meetings/:matchId` | 403 on fake matchId (correct) | — | ⚠️ Partial — alive; needs real match |
| 8 | Escrow dispute | `POST /api/v1/payments/:id/dispute` | 404 on fake bookingId (correct) | — | ⚠️ Partial — alive; needs real booking |
| 9 | Rental catalogue | `/api/v1/rentals` · `/rentals` | 200 | 200 | ✅ Working |
| 10 | Rental booking | `POST /api/v1/rentals/:id/book` | **201** | — | ✅ Working (tx-wrapped overbook guard verified Week 8) |
| 11 | Pre-wedding ceremonies | `GET /api/v1/weddings/:id/ceremonies` | 200 | — | ✅ Working (Week 8 ship) |
| 12 | Muhurat selector | `GET /api/v1/weddings/:id/muhurat` | 200 | — | ✅ Working (Week 8 ship) |
| 13 | E-commerce store | `/api/v1/store/products` · `/store` | 200 | 200 | ✅ Working (Week 9) |
| 14 | Order placement | `POST /api/v1/store/orders` | 201 · tx stock decrement · unitPrice snapshot correct | 200 | ✅ Working (Week 9) |
| 15 | Vendor store | `/api/v1/store/vendor/products` · `/vendor-dashboard/store` | 200 | 200 | ✅ Working (Week 9) |

**Score: 11 ✅ · 4 ⚠️ · 0 ❌**

## ⚠️ item dispositions

| Item | Severity | Action |
|------|----------|--------|
| 3. Budget GET endpoint | Low | Defer to Week 10 ergonomic sweep. Web already works via wedding-detail payload. |
| 5. RSVP live-token probe | Low | Already covered by Week 6 smoke-test-week6.md. Live flow works end-to-end when real token used. |
| 6. Video rooms real Daily.co | Medium (external) | Blocked on `DAILY_CO_API_KEY` — documented in Week 8 commit `9673d3a`. Unblocks after company registration / API key provisioning. |
| 7. Meetings real match exercise | Low | Requires two live profiles matched; covered in Week 7 chat/video smoke. |
| 8. Dispute real booking exercise | Low | Week 8 escrow-hardening commit `5d428a1` includes unit tests for the full dispute lifecycle. |

No ⚠️ items are blockers for Phase 2 sign-off.

## ❌ Critical issues

**None found.**

## New in Week 9 — E-Commerce Store (feature-complete)

- Product catalogue with category + price-range + text search, featured surface, soft delete, stock updates, R2 image key append endpoint
- Order placement with **Drizzle-transactional stock decrement** (applying Week 8 rental-overbooking lesson) and **unitPrice captured at order time** (never recalculated from live product price)
- Cancel order restores stock inside the same transaction
- Vendor fulfilment: `shipOrderItem` + `deliverOrderItem` with auto-promotion of `orders.status` when all items reach SHIPPED/DELIVERED
- Razorpay integration mocked (`apps/api/src/lib/razorpay.ts`) — real webhook (`POST /api/v1/store/webhook/razorpay`) wired but not yet exercised end-to-end; flip to live Razorpay with real key + webhook secret
- Zustand cart with `persist` middleware (localStorage key `smartshaadi-cart`)
- Customer UI: product browse, detail, cart drawer + page, checkout, order list + detail
- Vendor UI: product management (new/edit/stock/delete) + order fulfilment row with tracking input

## Test coverage

- API: **310/310 passing** (was 277 at start of Week 9; +33 new store tests across `product.service.test.ts` and `order.service.test.ts`, 24 test files total)
- Type-check: 8/8 packages clean

## Deferred to Week 10

1. Real Razorpay webhook exercise (requires real key + webhook secret + ngrok)
2. Real Daily.co room creation (requires `DAILY_CO_API_KEY`)
3. R2 pre-signed upload flow for product images (web stub currently shows "coming soon")
4. Dedicated `GET /api/v1/weddings/:id/budget` for cleaner web separation
5. Revenue aggregation on vendor store dashboard (currently `—` placeholder)
