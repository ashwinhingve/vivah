# Smart Shaadi — Phase 1 + 2 Code Review

*Generated: 2026-05-04 · Reviewer: parallel multi-agent senior-engineer sweep against working tree (includes uncommitted edits in `apps/api/src/lib/razorpay.ts`, `apps/api/src/lib/requestId.ts`, `apps/web/...`, `packages/db/schema/index.ts`, `eslint.config.js`).*

> Severity: **P0** = security / data-loss · **P1** = correctness · **P2** = performance · **P3** = hygiene.
> Each finding: file:line — one-line description — recommendation.

---

## Executive Summary

| Severity | Count |
|---|---|
| P0 (security / data-loss) | 26 |
| P1 (correctness) | 51 |
| P2 (performance) | 40 |
| P3 (hygiene) | 20 |
| **Total** | **~137** |

### Top 10 must-fix before Phase 3

1. **Paise/rupees unit confusion** — 4 distinct call sites in payments + bookings + dispute paths credit/refund 100× wrong amount. (Payments P0-1..4)
2. **Webhook raw-body fallback re-serialises with `JSON.stringify`** — silently fabricates HMAC for any payload that ever bypasses `express.raw()`. (Payments P0-6)
3. **TOTP secret leaked to third-party QR generator** (`api.qrserver.com`) — every 2FA enrollment exposes the secret to a logged external service. (Frontend P0-1)
4. **Session revocation accepts arbitrary token without ownership check** — any authenticated user can revoke any other user's sessions. (Auth P0-1)
5. **Booking double-book guard is outside its insert transaction** — concurrent requests can both pass conflict check and both succeed. (Payments P0-5)
6. **Order created but Razorpay `createOrder` failure leaves stock permanently reserved** — no rollback path; expiry job never enqueued. (Store P0-4)
7. **`sendInvitations` returns RSVP tokens in API response** — any wedding EDITOR can impersonate every guest. (Wedding P0-2)
8. **Socket `presence_update` broadcasts `profileId` to ALL connected sockets globally** — any logged-in user can harvest live presence of every active user. (Chat P0-1, P0-2)
9. **`fetchLinkPreview` is unrestricted SSRF** — any auth'd user can fetch `http://169.254.169.254/...` etc. (Chat P1-3, treat as P0)
10. **Mock-mode OTP returned in plaintext in API body** — if `USE_MOCK_SERVICES=true` ever ships to staging/prod, OTPs leak in response bodies. (Auth P0-2)

---

## Cross-cutting Patterns

These are not single bugs — they are anti-patterns that recur and need a sweep, not a one-off fix.

| Pattern | Domains | Severity |
|---|---|---|
| **Paise vs rupees** confusion at the Razorpay boundary | Payments, Bookings, Dispute, Wallet | P0 |
| **userId ↔ profileId** conflation (CLAUDE.md rule 12) | Matching, Chat | P1 |
| **Mongoose calls without `USE_MOCK_SERVICES` guard** (rule 11) | Matching engine name-enrichment, Chat reply lookup | P0–P1 |
| **N+1 enrichment** — per-row Mongo/Postgres lookup inside list endpoints | Matching feed, shortlists, bookings, weddings | P1–P2 |
| **Read-then-write without serialisable txn** (TOCTOU races) | Bookings, Refunds, Promo redeem, Match accept, Order shipping | P0–P1 |
| **Status-update without `WHERE old_status=…`** optimistic lock | Match accept, Booking cancel, Payment capture | P1 |
| **Unbounded list endpoints** (no pagination / limit) | KYC pending, Vendor products, Vendor orders, Match feed cache replay | P1–P2 |
| **Raw `sql\`IN ${arr}\``** instead of `inArray()` helper | Wedding day-of, Coordinator service | P1 |
| **Email/phone PII leaks** through API response without masking | Auth /security/overview, Wedding coordinators list | P0–P1 |
| **Webhook idempotency keys derived from signature prefix** | Payments + Store webhooks | P0–P2 |

---

## 1. Auth + KYC

### P0 (security)

- **`apps/api/src/auth/securityRouter.ts:78-97`** — `DELETE /sessions/:token` calls `auth.api.revokeSession({ body: { token } })` with caller-supplied token. Better Auth revokes whichever session matches, no `userId` check. — *Verify target session's `userId === req.user!.id` before revoking.*
- **`apps/api/src/auth/securityRouter.ts:286`** — Mock-mode response includes `mockCode: code` (raw 6-digit OTP) in body. If `USE_MOCK_SERVICES` is ever true in staging/prod the OTP leaks via response. — *Log to console only, never in response body.*
- **`apps/api/src/kyc/service.ts:93-103`** — Duplicate-device fingerprint uses caller-controlled IP + UA. Trivially spoofable. — *Dedupe on Aadhaar `refId` instead of session IP/UA.*

### P1 (correctness)

- **`apps/api/src/auth/securityRouter.ts:305-308`** — Off-by-one in OTP attempt counter: 6th attempt leaks "wrong code" before 429. — *Use `>= 5` or move increment after the guard.*
- **`apps/api/src/auth/config.ts:123-126`** — Raw `sql\`UPDATE verification SET value=...\`` updates all rows for the identifier; can stomp concurrent OTP rows. — *Use `db.update()` with full PK or `LIMIT 1`.*
- **`apps/api/src/kyc/service.ts:448-456`** — `requestReverification` updates without verifying row exists; silently writes 0 rows. — *Check `ensureKycRow` first like other writers.*
- **`apps/api/src/kyc/service.ts:690-693`** — `approveKyc` guard inverted: returns `KYC_IN_REVIEW` when profile is **not** in review. — *Use `KYC_INVALID_STATE` for the not-in-review case.*
- **`apps/api/src/kyc/rateLimit.ts:60`** — `redis.keys('kyc:rate:*:<id>')` is O(N) on full keyspace, blocks Redis. — *Use SCAN cursor or deterministic key names + DEL.*
- **`apps/api/src/auth/middleware.ts:51-56`** — Deletion bypass uses `req.path` (router-relative). Shared middleware on other routers may match unintended paths. — *Use `req.originalUrl` or scope check inside `securityRouter`.*
- **`apps/api/src/auth/securityRouter.ts:163-164`** — Email returned unmasked in `/security/overview` response (rule 5 violation). — *Mask `u*****@domain.com`.*
- **`apps/api/src/kyc/service.ts:820-849`** — `getKycStats` runs 7 sequential `COUNT` queries. — *Single query with `COUNT(*) FILTER (WHERE …)` aggregates.*

### P2 (performance)

- **`apps/api/src/auth/securityRouter.ts:57-59`** — Two `getSession` round-trips per `GET /sessions`. — *Reuse `req.user` and read `currentToken` from cookie.*
- **`apps/api/src/auth/lastActive.ts:15`** — In-process `Map` grows unboundedly; no eviction. — *LRU cache (`lru-cache`) with `max: 50_000` or scheduled prune.*
- **`apps/api/src/kyc/service.ts:650-673`** — `getPendingKycProfiles` returns unbounded rows; no LIMIT. — *Add cursor pagination, document max page size.*

### P3 (hygiene)

- **`apps/api/src/auth/securityRouter.ts:303`** — `JSON.parse(...) as { phone, code, attempts }` trusts Redis payload without validation. — *Zod parse before use.*
- **`apps/api/src/auth/config.ts:54`** — `useSecureCookies: false` permanent (intended for subdomain consistency). — *Verify deployed cookie still has `Secure` flag in DevTools.*
- **`apps/api/src/kyc/service.ts:33`** — `loadProfile` does wildcard `db.select()` on profiles (20+ cols). — *Explicit column list.*
- **`apps/api/src/kyc/audit.ts`** — Audit writes mixed `await`/fire-and-forget; no surrounding txn so audit failure can 500 after KYC state already committed. — *Wrap state update + audit write in single `db.transaction`.*
- **Tests** — No coverage for: session-revocation ownership, OTP attempt boundary (`attempts === 5`), `assertNotTerminal` / `assertNotInReview` transitions, `runRiskPass` AUTO_REJECT path.

---

## 2. Matching engine

### P0 (security)

- **`apps/api/src/matchmaking/engine.ts:600-643`** — `computeAndCacheFeed` fires per-row `ProfileContent.findOne` (50+ serial Mongo round-trips), no `USE_MOCK_SERVICES` guard. Each error silently swallowed; failed Mongo crashes after 10s timeout. — *Single `Content.find({ userId: { $in } })` batch + mock guard at top.*
- **`apps/api/src/matchmaking/requests/service.ts:691-774`** — `getEnrichedRequests` returns `declineReason` in the **sender's** view of their sent requests (was meant to be moderation-internal). — *Null `declineReason` for `side=sent`.*

### P1 (correctness)

- **`engine.ts:527`** — `applyHardFilters` only checks user→candidate; `toFilterProfile` (line 299-300) sets `preferences.city = p.city` (own city, not preference) — bilateral distance match silently broken. — *Use the `preferences.preferredCity` field; verify both directions.*
- **`requests/service.ts:147-194`** — Re-request after WITHDRAWN: app guard passes but DB unique constraint `match_unique_pair` throws raw Postgres error. — *Either soft-delete the withdrawn row or catch the constraint and return clean error.*
- **`requests/service.ts:237-254`** — `acceptRequest` is read-then-write with no `WHERE status='PENDING'` on UPDATE. Two concurrent accepts both pass guard, second silently overwrites + double Chat doc. — *Add `and(eq(status,'PENDING'))` to UPDATE WHERE; check `updated === undefined`.*
- **`engine.ts:428-432`** — `blockedUsers` capped at `limit(1000)`; profiles with >1000 blocks leak past filter. — *`noLimit()` or JOIN-based subquery.*
- **`router.ts:48-50`** — Cached feed ignores caller's `page`/`limit` query params; returns full cached array. — *Slice cached array by page/limit before responding.*
- **`requests/service.ts:619-626`** — `getReceivedRequests` total count not filtered by status; includes DECLINED/EXPIRED. — *Filter count to active statuses or expose status filter.*
- **`engine.ts:447-449`** — Candidate query has **no gender-opposite filter**; `applyHardFilters` has no gender dimension. Same-gender profiles surface in feed. — *Add `gender !== userGender` to query or hard filters.*
- **`shortlists/service.ts:228`** — Shortlist enrichment uses `{ profileId: targetId }` but engine uses `{ userId: uid }` for same Mongo doc → silent null in production. — *Standardise key.*
- **`requests/service.ts:804-805`** — `getWhoLikedMe` `total` returns current page length, not real total. — *Separate count query.*

### P2 (performance)

- **`engine.ts:498` + `503-508`** — Two passes of per-candidate Mongo reads (up to 1,000 round-trips per feed compute). — *Merge into one batched read.*
- **`shortlists/service.ts:193-213`** — `enrichOne` per item: 2 Postgres queries + 1 Mongo per shortlist item (40 round-trips for page of 20). — *Batch profile + photo lookups upfront.*
- **`engine.ts:566-574`** — Per-candidate primary-photo SELECT inside loop (up to 500 sequential queries). — *Single `WHERE profileId IN (…)`.*
- **`requests/service.ts:706-715`** — Sequential `profileRows` then `photoRows` queries; should be one LEFT JOIN. — *Combine.*
- **`schema/index.ts:649-660`** — `score_pair_idx` unique on `(profileA, profileB)` but Redis cache key uses sorted pair → DB queries that don't sort miss the index. — *Canonical ordering on insert or partial index for both orientations.*

### P3 (hygiene)

- **`router.ts:214-216`** — `/profile-of-day` cache key `pod:YYYY-MM-DD` in UTC; rotates at 05:30 IST. — *Use `Asia/Kolkata` timezone.*
- **`router.ts:161`** — `/who-liked-me` clamps `limit` but has no offset/cursor; combined with broken `total` (P1 above) cannot paginate. — *Add cursor.*
- **`engine.ts:123-134`** — `DrizzleDB`/`SelectChain` duck-type returns `unknown[]`; loses all schema type-safety. — *Use real Drizzle types or `vi.mock`.*
- **`jobs/matchRequestExpiryJob.ts:48`** — No `removeRepeatable` cleanup on startup; deploys with changed `every` leave stale repeatables. — *`queue.removeRepeatableByKey()` on registration.*
- **`requests/service.ts:296,334`** — `const userId = callerProfileId` actively misleading alias (CLAUDE.md rule 12 anti-pattern). — *Remove alias.*

---

## 3. Chat + Socket.io

### P0 (security)

- **`apps/api/src/chat/socket/handlers.ts:54`** — `socket.broadcast.emit('presence_update', ...)` on connect broadcasts `profileId` to **all** sockets globally. Any logged-in user harvests every online user's profileId. — *Scope to `socket.to(matchRequestId)` after room join, or fan-out to participant rooms only.*
- **`handlers.ts:88`** — Same global broadcast on disconnect. — *Same fix.*
- **`handlers.ts:513-516`** — `typing` event emits raw `userId` (Better Auth) to room peers. `userId` must never leave server boundary. — *Remove `userId` from emitted payload.*
- **`handlers.ts:269-281, 288`** — Push-notif lookup passes `receiverProfileId` as `userId` field on the queue job. Worker that resolves Better Auth user by this value silently fails to deliver. — *Resolve real `userId` via DB before enqueuing; fix field name.*

### P1 (correctness / security)

- **`handlers.ts:96-104`** — `loadParticipants` real-mode path uses `Chat.findOne({ matchRequestId })` with no `participants: profileId` filter. Foreign-conversation participant list leak. — *Add `participants: profileId` to query.*
- **`handlers.ts:174`** — `send_message` reply-context lookup omits `participants` filter; an attacker who knows a foreign `matchRequestId` can probe message existence. — *Same fix.*
- **`apps/api/src/chat/router.ts:557-568`** — `GET /chat/link-preview?url=` is **SSRF**: blocks only protocol + content-type, not RFC-1918 / link-local IPs. Attacker can fetch `http://169.254.169.254/...` (cloud metadata). — *Add IP-range blocklist before fetch.*
- **`handlers.ts:460-468` + `481-495`** — `delivered_ack` / `mark_read` accept client-supplied `messageIds` array passed to `$in` with no length cap or type check. — *Zod validation, cap at ~100 items.*
- **`handlers.ts:268-297`** — `loadParticipants` called twice in the same `send_message` flow. — *Consolidate.*
- **`apps/api/src/chat/conversations.service.ts:151-156`** — `listConversations` materialises full `messages[]` array in memory to compute unread count. O(n) on conversation length. — *Project minimal fields with `.lean()`, or maintain per-user unread counter atomically on `$push`/`mark_read`.*

### P2 (performance / prod-readiness)

- **`router.ts:595-613`** — Chat `report` endpoint embeds raw `reason` as `[reported] ${reason}` in chat messages array → stored XSS if admin UI lacks escape. — *Separate `reports` collection.*
- **`socket/index.ts:49`** — `attachRedisAdapter` is fire-and-forget (`void`); messages sent during the gap are local-only across multi-instance deploy. — *`await attachRedisAdapter(io)` first or warn on emit when unattached.*
- **No socket-event rate limiting** — `send_message`, `react_message`, `typing`, `join_room` have zero per-socket throttling. — *Token-bucket per socket on at minimum `send_message` and `typing`.*
- **`send_message`** — `photoKey`/`voiceKey` accepted as arbitrary-length strings; only `content` length-capped. — *512-char cap on each.*
- **`conversations.service.ts:184`** — `mutedUntil` fabricated as `now + 1 year` for all muted convs (schema only stores boolean array). UI receives misleading timestamp. — *Add real `mutedUntil` per user or change to boolean.*
- **`handlers.ts:221-233`** — In mock mode emitted `_id` is `Date.now().toString()` (non-stable, unusable for reply/edit refs). — *UUID fallback or document.*
- **`handlers.ts:460-468, 481-495`** — `messageIds` typed as `string[]` at compile time but TypeScript does not protect socket payloads. — *Runtime Zod array validation.*

### P3 (hygiene)

- **`presence.ts:22`** — `lastSeenAt` Redis key has no TTL; persists forever per user. — *90-day EX.*
- **`router.ts:76`** — `forward-targets` calls `getParticipantPreview(id)` per id (each fan-outs to PG + Mongo + Redis); already-batched `buildParticipantPreviews` available. — *One batched call.*
- **`router.ts:126-130`** — Message pagination loads full messages array into memory then sorts in JS. — *Aggregation with `$slice` + sort pushed to DB; eventually move to top-level collection.*
- **`router.ts:460-478`** — `as never` cast on `dest.messages.push(...)` masks Mongoose schema mismatches. — *Typed push.*
- **Tests** — Zero coverage for socket auth (`assertParticipant`), `send_message` persist-then-emit ordering, bulk `mark_read`/`delivered_ack` array-filter paths.

---

## 4. Vendors + Bookings + Payments

### P0 (security / data-loss)

- **`apps/api/src/payments/wallet.ts:218`** — `creditWalletForTopup` does `amount * 100` but caller (`webhook.ts:135`) already passes rupees — wallet credited 100× the correct balance. — *Remove `* 100`.*
- **`apps/api/src/payments/service.ts:218`** — Legacy `requestRefund` passes rupees to `createRefund` (Razorpay needs paise). — *Multiply by 100.*
- **`apps/api/src/payments/dispute.ts:364, 419`** — `createRefund` called with `escrowTotal`/`customerAmount` in rupees; refund fires 100× too small. — *Multiply by 100.*
- **`apps/api/src/bookings/service.ts:532`** — `cancelBooking` calls `createRefund(.., refundAttempt.amount)` in rupees. Same paise/rupees bug. — *Multiply by 100.*
- **`apps/api/src/bookings/service.ts:160-194`** — Conflict-check runs **outside** the booking-insert transaction. Two concurrent customers can both pass and both insert. — *Move conflict check + INSERT into single serializable txn or unique partial index `(vendorId, eventDate) WHERE status IN ('PENDING','CONFIRMED')`.*
- **`apps/api/src/payments/webhook.ts:62-66`** — When `req.body` is not Buffer/string, falls back to `JSON.stringify(req.body)` for HMAC. Fabricates wrong signature; if `express.json` ever runs first this silently passes wrong payload as valid. — *Assert `Buffer.isBuffer(req.body)`; 500 otherwise.*

### P1 (correctness / security)

- **`apps/api/src/payments/refunds.ts:243-248`** — Over-refund check (`getRefundedSoFar`) runs before Razorpay call; PROCESSING lock at line 212 leaves a window between read and lock. — *Move sum + status transition into one txn.*
- **`apps/api/src/bookings/service.ts:54-109`** — `toBookingSummary` issues 4 queries per row (vendor name, escrow, addons, review). N+1 across booking lists. — *Batch with `inArray` before summarising.*
- **`apps/api/src/payments/payoutsRouter.ts:64-75`** — Inline `assertAdmin` DB lookup instead of `authorize(['ADMIN'])`. Inconsistent and adds a round-trip. — *Use middleware.*
- **`apps/api/src/vendors/router.ts:224`** — View-count increment condition `!req.user || req.user.id` is always truthy → vendor self-views inflate own count. — *Compare `!== ownerUserId`.*
- **`apps/api/src/payments/dispute.ts:291-305`** — `disputeResolutions` insert + booking optimistic update not atomic. Crash between leaves booking permanently DISPUTED. — *Wrap in txn.*
- **`apps/api/src/payments/promo.ts:108-133`** — `redeemPromo` increments `usedCount` in txn but `usageLimit` check at quote-time outside lock → overshoot under concurrency. — *Repeat check inside redeem txn with conditional update.*
- **`apps/api/src/payments/dispute.ts:97-99`** — `raiseDispute` requires `escrow.status === 'HELD'`; COMPLETED bookings (escrow RELEASED) cannot be disputed at all. Product-correctness gap. — *Decide policy + clearer error.*
- **`apps/api/src/payments/service.ts:139-146`** — `handlePaymentSuccess` idempotency check on payment status not atomic. Two concurrent `payment.captured` webhooks may both pass guard. — *Conditional update `WHERE id=? AND status='PENDING'`.*

### P2 (performance / correctness)

- **`apps/api/src/payments/webhook.ts:100-102`** — Idempotency fallback `eventId = signature.slice(0,16)` — possible collision across distinct events. — *Full signature or content hash.*
- **`apps/api/src/payments/dispute.ts:372-374`** — REFUND branch sets escrow = `REFUNDED` before refund call; on Razorpay failure escrow stays `REFUNDED` while payment is `REFUND_PENDING` (inconsistent). — *Set escrow to `REFUND_PENDING` on failure.*
- **`apps/api/src/payments/dispute.ts:310-315, 333`** — RELEASE branch logs `DISPUTE_RESOLVED_RELEASE` to audit chain even on transfer failure. — *Move audit append after successful transfer.*
- **`apps/api/src/payments/dispute.ts:72, 90`** — `let vendorId: string` declared then assigned inside txn closure; `vendorId!` non-null assertion suppresses strict-mode error. — *Type as `string | undefined` and check.*
- **`apps/api/src/bookings/service.ts:492-494`** — Cancellation throws `REFUND_FAILED` if escrow `HELD` but payment row missing `razorpayPaymentId` (capture not yet via webhook). Customer cannot cancel. — *Allow cancellation with safe `REFUND_PENDING` state.*
- **`apps/api/src/lib/razorpay.ts:347-352`** — `fetchSettlements` silently returns `[]` on any non-2xx (incl. auth fail). — *Throw or discriminated-union error.*
- **`apps/api/src/payments/invoiceRouter.ts:37-40`** — `GET /invoices/admin/list` has no `authorize(['ADMIN'])` middleware; defense-in-depth gap. — *Add middleware.*
- **`apps/api/src/payments/webhook.ts:181-185`** — `refund.processed` sets payment to `REFUNDED` whenever it isn't already `PARTIALLY_REFUNDED` — partial refunds incorrectly mark payment as fully refunded. — *Sum completed refunds vs `payment.amount`.*

---

## 5. Wedding Planning + Guests

### P0 (security)

- **`apps/api/src/guests/invitation.ts:66` & `apps/api/src/weddings/publicRsvp.service.ts:46`** — RSVP token is unsigned opaque random; two parallel token systems coexist (legacy `invitations.messageId` UUID and `rsvp_tokens` table). Stale legacy token can replay. — *Remove `invitations.messageId` fallback; HMAC-sign canonical tokens with `guestId:expiresAt`.*
- **`apps/api/src/guests/invitation.ts:133`** — `details.push({ guestId, token })` — `sendInvitations` returns RSVP tokens in the API response body. Any wedding EDITOR sees every guest's token. — *Return only `{ guestId, delivered: true }`.*
- **`apps/api/src/weddings/coordinator.service.ts:177`** — `listCoordinatorsForWedding` returns `email` of each coordinator (rule 5 violation). — *Strip or mask email.*
- **`apps/api/src/weddings/extras.router.ts:381` (`POST /rsvp/:token`)** — Public RSVP routes have no rate limit / CAPTCHA. — *`express-rate-limit` 10 req/min per IP on `publicRsvpRouter`.*

### P1 (correctness / security)

- **`apps/api/src/guests/extraServices.ts:32-38`** — `gateOwner` hard-checks owner only; coordinator EDITOR access is silently rejected. — *Use `requireRole(weddingId, userId, 'EDITOR')`.*
- **`apps/api/src/weddings/service.ts:211-231` & `coordinator.service.ts:215-242`** — `listUserWeddings` is N+1 on tasks (`1 + N`); `listMyManagedWeddings` is `1 + 4N` (ceremonies + tasks + incidents per wedding). — *Batch with `WHERE weddingId IN (…)`.*
- **`apps/api/src/guests/service.ts:253-255`** — `bulkImportGuests` has no row cap at service or schema (docstring says 500 but no enforcement). — *Zod `.max(500)` + service-level guard.*
- **`apps/api/src/weddings/service.ts:803-806`** — `selectMuhurat` updates `weddingDate` with WHERE only on `weddingId`, not `profileId`. — *Add ownership predicate to UPDATE.*
- **`apps/api/src/jobs/invitationBlastJob.ts:23-33`** — Worker is a no-op stub; queued blasts silently dropped in production. — *Implement fan-out or `throw` until wired.*
- **`apps/api/src/guests/service.ts:361-368`** — Legacy `updateRsvp` doesn't check `rsvpAt`; guest can flip status repeatedly with same token. — *Add `RSVP_ALREADY_USED` guard.*
- **`apps/api/src/guests/router.ts:418-420`** — `sendInvitations` itself has no auth check — relies on caller doing `getGuestList` first. Job paths skip the check. — *Move owner assertion into `sendInvitations`.*
- **`apps/api/src/weddings/dayOf.service.ts:55-64`** — `sql\`${guests.guestListId} IN ${listIds}\`` — raw template, not `inArray()` helper. Type-safety loss; potential injection if `listIds` ever from user input. — *Use `inArray()`.*

### P2 (performance / hygiene)

- **`apps/api/src/weddings/coordinator.service.ts:212`** — Same raw `sql\`IN ${ids}\`` pattern. — *`inArray()`.*
- **`apps/api/src/jobs/rsvpReminderJob.ts:43-48`** — Calls `sendInvitations(weddingId, ...)` without `userId`; will break once auth moved inside (P1 above). — *Resolve owner userId and pass through.*
- **`packages/db/schema/index.ts:935` + `apps/api/src/guests/service.ts:230-237`** — `weddings.guestCount` never updated; `listUserWeddings` always returns 0. — *Increment/decrement on add/bulk/delete.*
- **`apps/api/src/weddings/dayOf.service.ts:197-222`** — Ceremony status transitions unguarded; `COMPLETED → IN_PROGRESS` allowed. — *Whitelist transitions, 409 on illegal.*
- **`apps/api/src/weddings/publicRsvp.service.ts:231-238`** — Thank-you queue dedupe by `jobId` doesn't reset delay on YES→NO→YES flip; old enqueue still fires. — *`queue.remove(jobId)` before re-enqueue.*
- **`apps/api/src/weddings/access.ts:79`** — ADMIN granted COORDINATOR access to every wedding implicitly without assignment row. — *Document or require explicit assignment.*
- **`apps/api/src/weddings/router.ts:256-258`** — Comment says PUT but handler is GET. — *Fix comment.*

### P3 (hygiene)

- **Tests** — No coverage for public RSVP token flow (generate → view → submit → expiry); only unauth'd mutation surface in the API.
- **`apps/api/src/jobs/weddingReminderJob.ts:36-67`** — 100 reminders processed serially with `await` in `for` loop (~500ms blocking worker). — *`Promise.allSettled` with concurrency cap.*

---

## 6. E-commerce Store

### P0 (security / correctness)

- **`apps/api/src/lib/razorpay.ts:117-120`** — `constantTimeEqualHex` uses `Buffer.from(a, 'utf8')` (UTF-8 byte representation of hex string), not decoded hex. Mathematically equivalent today, but a single uppercase hex char would mismatch. — *`Buffer.from(a, 'hex')`.*
- **`apps/api/src/store/webhook.ts:47-50`** — Idempotency fallback `store:${eventType}-${signature.slice(0,16)}` collides on same-event-type. — *Full signature or body-hash.*
- **`apps/api/src/store/order.service.ts:111-140, 154-213`** — Stock check outside txn; product `isActive` not rechecked inside txn (only stock CAS protects). — *Move all product validation into txn.*
- **`apps/api/src/store/order.service.ts:216-243`** — Razorpay `createOrder` failure after stock decrement leaves stock permanently reserved + no expiry job. — *Try/catch around post-txn block; cancel order (restore stock) on Razorpay failure.*

### P1 (correctness / performance)

- **`apps/api/src/store/router.ts:243-258`** — `addProductImages` accepts arbitrary `r2Keys`; vendor can reference any R2 path. — *Regex/prefix-bind to vendor uploads.*
- **`apps/api/src/store/product.service.ts:130-135`** — `gte/lte(products.price, String(minPrice))` may compare lexicographically on decimal column. — *`sql\`${products.price} >= ${minPrice}::numeric\`` or numeric param.*
- **`apps/api/src/jobs/orderExpiryJob.ts:36-46`** — `cancelOrder` accepts `CONFIRMED` as cancellable; expiry job race could cancel a paid order and restore stock. — *Restrict expiry path to `PLACED` only.*
- **`apps/web/src/app/(app)/store/[productId]/page.tsx:56-61`** — `fetchProduct` called twice per render (also flagged in Frontend). — *Call once.*
- **`apps/api/src/store/product.service.ts:305-313`** — `getVendorProducts` unbounded; no pagination. — *limit/offset.*
- **`apps/api/src/store/order.service.ts:532-564`** — `getVendorOrders` unbounded. — *Pagination.*
- **`apps/api/src/store/order.service.ts:228-242`** — `orderExpiryQueue.add` failure only logs; order has no scheduled cleanup. — *Re-throw or fall back to immediate cancel.*

### P2 (correctness / prod-readiness)

- **`apps/api/src/store/order.service.ts:217`** — `Math.round(total * 100)` accumulates float error on summed `parseFloat(price) * qty`. — *Compute in paise from the start.*
- **`order.service.ts:170`** — `insertedOrder as OrderRow` unsafe cast. — *Remove cast; use returning type.*
- **`order.service.ts:354-405`** — `cancelOrder` allows cancelling CONFIRMED (paid) order without triggering refund flow. — *Trigger refund or block customer cancel of CONFIRMED.*
- **`router.ts:309-319`** — `page`/`limit` from query coerced with `Number(...)`, no upper cap. — *`Math.min(limit, 50)` or Zod.*
- **`webhook.ts:81`** — On `confirmOrder` failure responds 200 — Razorpay won't retry; failed event has no DLQ / admin retry. Customer pays but order stays PLACED. — *Persist failed events; admin retry surface.*
- **Tests** — No store-module test coverage. `confirmOrder` + expiry race and Razorpay-failure-during-create flow untested (CLAUDE.md mandates test for payment webhooks).

---

## 7. Frontend (Next.js App Router)

### P0 (security)

- **`apps/web/src/app/(app)/settings/security/two-factor/TwoFactorManager.client.tsx:265`** — TOTP `otpauth://` URI (containing raw secret) sent as `data=` query param to `api.qrserver.com`. External service logs the secret. — *Render QR client-side with `qrcode.react` or Canvas; never call third-party.*
- **`TwoFactorManager.client.tsx:31`** — `authClient.twoFactor.enable({ password: '' })` hardcoded empty password. — *Prompt user or remove field per Better Auth contract.*
- **`apps/api/src/lib/requestId.ts:27-28`** — Trusts client-supplied `x-request-id` (up to 100 chars) and writes verbatim to structured logs. Log injection vector. — *Strip to `[a-zA-Z0-9-]`.*

### P1 (correctness / performance / TS)

- **`apps/web/src/app/(app)/store/[productId]/page.tsx:56-61`** — `fetchProduct(productId)` called twice (once in `Promise.all`, again inside `.then` for related). — *Call once.*
- **`apps/web/src/app/(app)/admin/page.tsx:60-62`** — Admin guard falls through silently on `me === null` (API unreachable) → admin UI rendered. — *Render error/maintenance page on unknown auth state.*
- **`admin/page.tsx:55`** — Reads `better-auth.session_token` cookie name verbatim; not constant-typed. — *Env-configured constant.*
- **`apps/api/src/lib/razorpay.ts:100,156,174,215,263,287,300,309,321`** — SDK typed `unknown` then cast to `any` at every call site; eslint rule `no-explicit-any` is `error`. — *Define minimal typed SDK interface.*
- **`apps/web/src/components/providers/PostHogProvider.client.tsx`** — `useSearchParams()` outside `<Suspense>` de-opts entire app subtree from static rendering. — *Wrap inner consumer in Suspense / split component.*
- **`TwoFactorManager.client.tsx:80`** — After enroll, transitions to `show-backup-codes` and never to `enabled`; user stuck until reload. — *Add transition on dismissal.*
- **`razorpay.ts:341-352`** (`fetchSettlements`) — No `withRetry` wrapper; transient 5xx propagates as unhandled. — *Wrap with `withRetry`.*

### P2 (performance / a11y / hygiene)

- **`apps/web/src/app/(app)/rentals/[id]/page.tsx:17`** — `cache: 'no-store'` on detail page; cold API hit per visit. — *`{ next: { revalidate: 60 } }`.*
- **`store/[productId]/page.tsx:18-19`** — Same `no-store` perf regression. — *Revalidate.*
- **`TwoFactorManager.client.tsx:285-296`** — `ManualSecret` button shows raw 32-char secret as visible text, no `aria-label`. — *Add `aria-label="Copy TOTP secret"`.*
- **`rentals/[id]/page.tsx:119-124`** — Availability dot `aria-hidden` correct, status text has no `role`. — *`role="status"`.*
- **`admin/page.tsx:149`** — Audit-log placeholder `"Audit log endpoint coming in Phase 2 — Week 6"` shipped to admin users; Phase 2 is COMPLETE per CLAUDE.md. — *Real empty-state component.*
- **`store/[productId]/page.tsx:8-10`** — `product.imageKey` accessed but field not declared on `ProductDetail` (loose type). — *Verify `ProductSummary` includes `imageKey?`.*
- **`admin/page.tsx:7`** — `NEXT_PUBLIC_API_URL` (public env) used for server-to-server calls; should be private hostname in prod. — *Server-only env without `NEXT_PUBLIC_` prefix.*
- **`eslint.config.js:52-83`** — Brand-token guardrail only catches static `JSXAttribute[name='className']`; misses `cn(...)`/template literals. — *Document gap.*

### P3 (hygiene)

- **`PostHogProvider.client.tsx:7`** — Module-level `initialized` boolean drifts under Fast Refresh. — *Use `posthog.__loaded`.*
- **`TwoFactorManager.client.tsx:36`** — Better Auth result cast `as { totpURI?, backupCodes? }`. — *Use exported SDK return type.*
- **`admin/page.tsx:119` & `rentals/[id]/page.tsx:151`** — Plain `<a href>` for in-app nav; full reload. — *`<Link>` from `next/link`.*

---

## Test Coverage Gaps (consolidated)

Critical paths with **zero or near-zero** automated coverage (cross-domain):

- **Auth security**: session-revocation ownership check; phone-OTP attempt-counter boundary; `assertNotTerminal`/`assertNotInReview` state-machine; `runRiskPass` AUTO_REJECT.
- **Matching races**: concurrent `acceptRequest` (TOCTOU); re-request after WITHDRAWN; reciprocity violations; gender-filter regression.
- **Chat security**: socket `assertParticipant`; cross-conversation reply-context probe; bulk `mark_read` / `delivered_ack` array-filter validation; SSRF on `/link-preview`.
- **Payments**: webhook signature negative paths (raw-body fallback, replay, idempotency-key collision); concurrent refund races; promo-redeem overshoot under concurrency; paise/rupees regression tests for every Razorpay call site.
- **Bookings**: concurrent double-book; cancel during HELD-without-paymentId.
- **Wedding public surface**: RSVP token generate→view→submit→expiry flow (only unauth'd mutation surface in the system).
- **Store**: `confirmOrder` ↔ expiry-job race; Razorpay-fail-during-createOrder rollback path; webhook signature; partial-vs-full refund roll-up.

---

## Recommended Phase-3 Blockers

These must land **before** Phase 3 (AI Intelligence Layer) work begins. Anything else can ship as a Phase 2.x cleanup.

1. **All 4 paise/rupees fixes** (`wallet.ts`, `service.ts`, `dispute.ts` ×2, `bookings/service.ts`) — silent 100× money mis-transfers.
2. **TOTP secret leak** — replace 3rd-party QR with client-side render.
3. **Session revocation ownership** — trivial auth-bypass.
4. **Webhook raw-body assertion** — fail loud, not silent, when not Buffer.
5. **Booking double-book** — txn-wrap or unique partial index.
6. **Order rollback on Razorpay failure** — stock leak.
7. **Socket presence broadcast scoping** — global profileId leak.
8. **`/chat/link-preview` SSRF blocklist**.
9. **Concurrent `acceptRequest` lock** — silent overwrite + duplicate Chat.
10. **Mock-mode OTP** removed from response body; **`sendInvitations`** strip token from response.
11. **RSVP token HMAC + dual-path collapse**; rate-limit `publicRsvpRouter`.
12. **Email masking** in `/security/overview` and coordinator list.
13. **Wedding ADMIN guard on `selectMuhurat`** UPDATE WHERE.
14. **Mongo `USE_MOCK_SERVICES` guard** on every `ProfileContent.findOne` in matching engine + chat reply lookup.

P1 sweeps that are quick wins: status-update CAS guards everywhere; `inArray()` instead of raw `sql\`IN\`` (all sites); pagination caps on KYC/vendor/store list endpoints; admin audit-log placeholder removal.

---

*Source: 7 parallel `feature-dev:code-reviewer` agent runs against working tree at HEAD `876af2c` plus uncommitted edits. Generated 2026-05-04.*
