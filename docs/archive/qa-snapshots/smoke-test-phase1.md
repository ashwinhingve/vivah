# Smoke Test — Phase 1 Production Readiness

> Manual end-to-end checklist after the Phase A/B/C/D sweep (commits `c6297ce`,
> `596a0c6`, `45ec466`, this commit).
>
> Run with `USE_MOCK_SERVICES=true` and the local docker-compose stack
> (Postgres, Redis, Mongo). The test passes when **every step lands without
> a 5xx and the assertion column matches**.

## Setup

```bash
docker-compose up -d                      # postgres + redis + mongo + adminer
pnpm install
pnpm db:migrate                           # apply migrations against local DB
pnpm dev                                  # turbo runs api + web in parallel
```

API: `http://localhost:4000`  Web: `http://localhost:3000`

## Checklist

### 1. Auth + onboarding
| Step | Action | Assertion |
|------|--------|-----------|
| 1.1 | Register two users (User-A, User-B) — phone OTP via mock | OTP shown in API stdout, registration ok |
| 1.2 | Pick INDIVIDUAL role for both | Redirected to /profile/create |
| 1.3 | Complete personal/safety/photos for both | /profile/complete reached |

### 2. Match flow
| Step | Action | Assertion |
|------|--------|-----------|
| 2.1 | A: open /feed → click "Send request" on B | Request appears under B's /requests as PENDING |
| 2.2 | B: open /requests → "Accept" | Status = ACCEPTED, both see "Open chat" + "Reveal contact (mutual)" |
| 2.3 | Notifications worker: dispute test path doesn't apply, but verify MATCH_ACCEPTED in app notifications shows the recipient's user.id (not profile.id) | check via /api/v1/users/me/notifications |

### 3. Mutual contact unlock (Phase C)
| Step | Action | Assertion |
|------|--------|-----------|
| 3.1 | A clicks "Reveal contact (mutual)" | Button → "Awaiting their unlock…", message "Your side is unlocked. Waiting for the other person to unlock their contact." |
| 3.2 | A: GET /api/v1/profiles/<userB>/contact | 403 CONTACT_HIDDEN |
| 3.3 | B clicks "Reveal contact (mutual)" | Both sides now show contact card with phone + email |
| 3.4 | A: GET /api/v1/profiles/<userB>/contact | 200 with `{ phoneNumber, email }` |

### 4. Chat + media
| Step | Action | Assertion |
|------|--------|-----------|
| 4.1 | A → /chats?match=<id> → send text | Message appears for B in real time (Socket.io) |
| 4.2 | A: upload image (presigned PUT to /__mock-r2/...) | Returns 204, image renders for both |
| 4.3 | B: mark_read | A sees the read receipt |

### 5. Vendor packages CRUD (Phase C)
| Step | Action | Assertion |
|------|--------|-----------|
| 5.1 | Vendor V: POST /api/v1/vendors/<vid>/packages with `{ name, price, priceUnit }` | 201, body contains the new package |
| 5.2 | Customer C: GET /api/v1/vendors/<vid>/packages | 200, package visible (public) |
| 5.3 | Vendor V: PUT /api/v1/vendors/<vid>/packages/0 | 200, package updated |
| 5.4 | Other user: PUT to same path | 403 FORBIDDEN |
| 5.5 | Vendor V: DELETE /api/v1/vendors/<vid>/packages/0 | 200, packages now empty |

### 6. Booking + payment + invoice
| Step | Action | Assertion |
|------|--------|-----------|
| 6.1 | Customer C creates booking with vendor V | PENDING booking |
| 6.2 | C pays via mock checkout | Razorpay returns mock_order_*; webhook fires; booking → CONFIRMED; escrow row created |
| 6.3 | C downloads invoice PDF | apps/api/src/bookings/invoice.ts emits a valid PDF |

### 7. Dispute → notifications (Phase B C1)
| Step | Action | Assertion |
|------|--------|-----------|
| 7.1 | Customer C: POST /api/v1/payments/disputes/{bookingId} { reason } | 200 |
| 7.2 | Vendor V: GET /api/v1/users/me/notifications | Row with `title: "Customer raised a dispute"` |
| 7.3 | Admin: GET /api/v1/users/admin/notifications (or admin escrow page) | Row with `title: "Dispute needs admin review"` |

### 8. Production-blocker safety nets (Phase A)
| Step | Action | Assertion |
|------|--------|-----------|
| 8.1 | `curl http://localhost:4000/ready` with redis stopped | HTTP 503 with `{ checks: { redis: <error> } }` |
| 8.2 | `curl -X POST /api/v1/storage/upload-url` with `mimeType: "text/html"` | 400 VALIDATION_ERROR (allowlist enforced) |
| 8.3 | `curl /metrics` without bearer when METRICS_TOKEN set | 401 UNAUTHORIZED |
| 8.4 | `kill -SIGTERM <api-pid>` | Logs show: `HTTP server closed`, `draining N BullMQ workers`, `Redis disconnected`, `Postgres pool ended`, exit 0 within 30s |
| 8.5 | Web: deploy with bad NEXT_PUBLIC_API_URL | Server-side render throws on first request (zod failure) |

### 9. Background jobs
| Step | Action | Assertion |
|------|--------|-----------|
| 9.1 | Inspect `account-purge` BullMQ queue (no longer setInterval) | Repeatable job `account-purge-hourly` registered exactly once across all pods |
| 9.2 | Notifications queue receives a match `pushNotify` payload | Worker resolves `profileId` → `user.id` before delivery |

## Fail conditions

- 503 on /ready when DB/Redis/Mongo down → expected (was 200 before B7/I7)
- /metrics 200 without bearer when METRICS_TOKEN set → BLOCKER
- Match notifications never reach recipient device tokens → BLOCKER (regression of Phase B C1/pushNotify)
- Contact reveal returns content after only one side unlocked → BLOCKER (regression of Phase C mutual-unlock)
- Vendor package endpoints accept writes from non-owner → BLOCKER

## Verification commands

```bash
pnpm type-check
pnpm -C apps/api test   # 469 tests, no flake
pnpm -C apps/web lint   # 0 errors (img warnings only — rule is intentionally `warn`)
```
