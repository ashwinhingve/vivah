# API Design Guide

**Base URL:** `http://localhost:4000/api/v1` (dev) · `https://api.smart_shaadi.in/v1` (prod)

---

## Standard Response Envelope

Every API response uses this structure:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100, "limit": 20 },
  "error": null
}

// Error
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "Profile does not exist or is not visible to you.",
    "statusCode": 404
  }
}
```

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer {accessToken}
```

Refresh tokens are stored in httpOnly cookies and sent automatically by the browser.

```
POST /auth/register              → Register with phone + email
POST /auth/login/phone           → Request OTP to phone number
POST /auth/verify-otp            → Verify OTP, receive tokens
POST /auth/refresh               → Refresh access token
POST /auth/logout                → Invalidate session
POST /auth/kyc/initiate          → Start Digilocker KYC flow
GET  /auth/kyc/callback          → Digilocker redirect handler
```

---

## Endpoint Reference

### Auth & Identity

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Create account |
| POST | `/auth/login/phone` | None | Send OTP |
| POST | `/auth/verify-otp` | None | Verify OTP, get tokens |
| POST | `/auth/refresh` | Cookie | Refresh access token |
| POST | `/auth/logout` | Yes | End session |
| POST | `/auth/kyc/initiate` | Yes | Start KYC verification |

### Profiles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profiles/me` | Yes | Get own profile |
| PUT | `/profiles/me` | Yes | Update profile fields |
| POST | `/profiles/me/photos` | Yes | Upload profile photo |
| DELETE | `/profiles/me/photos/:id` | Yes | Remove photo |
| GET | `/profiles/:id` | Yes | View another profile |
| PUT | `/profiles/me/preferences` | Yes | Update partner preferences |
| PUT | `/profiles/me/safety-mode` | Yes | Toggle contact visibility |
| POST | `/profiles/me/unlock/:matchId` | Yes | Unlock contact for match |

### Matchmaking

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/matchmaking/feed` | Yes | Get today's match recommendations |
| GET | `/matchmaking/search` | Yes | Filter-based partner search |
| GET | `/matchmaking/score/:profileId` | Yes | Compatibility score vs profile |
| POST | `/matchmaking/requests` | Yes | Send match request |
| PUT | `/matchmaking/requests/:id` | Yes | Accept / decline request |
| DELETE | `/matchmaking/requests/:id` | Yes | Withdraw sent request |
| POST | `/matchmaking/block/:profileId` | Yes | Block a profile |
| POST | `/matchmaking/report/:profileId` | Yes | Report a profile |
| GET | `/matchmaking/requests/received` | Yes | Incoming match requests |
| GET | `/matchmaking/requests/sent` | Yes | Sent match requests |

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/conversations` | Yes | List all conversations |
| GET | `/chat/conversations/:matchId` | Yes | Get message history |
| POST | `/chat/conversations/:matchId/photos` | Yes | Upload photo to chat |

*Real-time messaging via Socket.io — see ARCHITECTURE.md*

### Vendors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/vendors` | Yes | List vendors (filter: category, city) |
| GET | `/vendors/:id` | Yes | Vendor profile and portfolio |
| GET | `/vendors/:id/availability` | Yes | Vendor available dates |
| POST | `/vendors` | Vendor | Create vendor listing |
| PUT | `/vendors/:id` | Vendor | Update vendor listing |
| POST | `/vendors/:id/services` | Vendor | Add service package |

### Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/bookings` | Yes | Create booking request |
| GET | `/bookings` | Yes | List my bookings |
| GET | `/bookings/:id` | Yes | Get booking details |
| PUT | `/bookings/:id/confirm` | Vendor | Confirm booking |
| PUT | `/bookings/:id/cancel` | Yes | Cancel booking |
| PUT | `/bookings/:id/complete` | Yes | Mark event as completed |

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/order` | Yes | Create Razorpay order |
| POST | `/payments/webhook` | None | Razorpay webhook handler |
| GET | `/payments/history` | Yes | Payment history |
| POST | `/payments/refund/:paymentId` | Yes | Request refund |
| GET | `/payments/escrow/:weddingId` | Yes | Escrow account status |

### Weddings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/weddings` | Yes | Create wedding plan |
| GET | `/weddings/:id` | Yes | Get wedding plan |
| PUT | `/weddings/:id` | Yes | Update wedding plan |
| GET | `/weddings/:id/tasks` | Yes | Get task board |
| POST | `/weddings/:id/tasks` | Yes | Create task |
| PUT | `/weddings/:id/tasks/:taskId` | Yes | Update task status |
| POST | `/weddings/:id/members` | Yes | Invite family member |

### Guests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/weddings/:id/guests` | Yes | Get guest list |
| POST | `/weddings/:id/guests` | Yes | Add guest(s) |
| PUT | `/weddings/:id/guests/:guestId` | Yes | Update guest details |
| POST | `/weddings/:id/invitations/send` | Yes | Send invitations |
| PUT | `/weddings/:id/guests/:guestId/rsvp` | None | RSVP update (link-based) |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Yes | Get notification history |
| PUT | `/notifications/:id/read` | Yes | Mark notification read |
| PUT | `/notifications/read-all` | Yes | Mark all read |
| PUT | `/notifications/preferences` | Yes | Update notification prefs |

### E-Commerce (Products & Orders)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | Yes | Browse products (filter: category, vendor, city) |
| GET | `/products/:id` | Yes | Product detail page |
| POST | `/products` | Vendor | Create product listing |
| PUT | `/products/:id` | Vendor | Update product |
| DELETE | `/products/:id` | Vendor | Remove product listing |
| GET | `/cart` | Yes | Get current cart |
| POST | `/cart/items` | Yes | Add item to cart |
| PUT | `/cart/items/:id` | Yes | Update cart item quantity |
| DELETE | `/cart/items/:id` | Yes | Remove cart item |
| POST | `/orders` | Yes | Place order (from cart) |
| GET | `/orders` | Yes | Customer order history |
| GET | `/orders/:id` | Yes | Order details + tracking |
| PUT | `/orders/:id/cancel` | Yes | Cancel order (before shipping) |
| GET | `/vendor/orders` | Vendor | Vendor incoming orders |
| PUT | `/vendor/orders/:itemId/ship` | Vendor | Mark item shipped + tracking number |
| PUT | `/vendor/orders/:itemId/deliver` | Vendor | Mark item delivered |

### Admin

| Method | Endpoint | Auth (Admin) | Description |
|--------|----------|------|-------------|
| GET | `/admin/users` | Admin | List all users |
| PUT | `/admin/users/:id/status` | Admin | Activate / suspend user |
| GET | `/admin/vendors/pending` | Admin | Vendors awaiting approval |
| PUT | `/admin/vendors/:id/approve` | Admin | Approve vendor |
| GET | `/admin/complaints` | Admin | Open complaint queue |
| GET | `/admin/analytics` | Admin | Platform analytics |

### AI Service Endpoints (Internal)

*Called by API service only — not exposed to clients directly*

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/match/score` | Compatibility score |
| POST | `/ai/match/recommend` | Daily match feed |
| POST | `/ai/horoscope/guna` | Guna Milan calculation |
| POST | `/ai/conversation/coach` | Ice-breaker suggestions |
| POST | `/ai/conversation/emotion` | Emotional score |
| POST | `/ai/profile/optimize` | Profile improvement tips |
| POST | `/ai/profile/readiness` | Marriage Readiness Score |
| POST | `/ai/churn/predict` | Churn risk score |
| POST | `/ai/fraud/profile` | Profile fraud flags |
| POST | `/ai/vendor/recommend` | Vendor suggestions |

---

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | No valid token |
| `FORBIDDEN` | 403 | Valid token but insufficient role |
| `PROFILE_NOT_FOUND` | 404 | Profile doesn't exist or not visible |
| `MATCH_REQUEST_EXISTS` | 409 | Match request already sent |
| `BOOKING_CONFLICT` | 409 | Vendor not available on that date |
| `PAYMENT_FAILED` | 402 | Razorpay payment failure |
| `KYC_PENDING` | 403 | Action requires verified profile |
| `CONTACT_LOCKED` | 403 | Contact details not unlocked yet |
| `RATE_LIMITED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 422 | Input validation failed (Zod) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Pagination

All list endpoints support:
```
GET /vendors?page=1&limit=20&city=Mumbai&category=photography
```

Response `meta`:
```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 147,
    "totalPages": 8
  }
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Auth (OTP send) | 3 requests / 10 min / phone |
| Match requests | 20 requests / hour / user |
| Chat messages | 100 messages / minute / conversation |
| Search/feed | 60 requests / minute / user |
| All other endpoints | 200 requests / minute / user |
| Webhooks (Razorpay) | No limit (verified by signature) |
