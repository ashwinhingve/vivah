# Smoke Test — Week 4 (Match Requests + Real-Time Chat)

**Date:** 2026-04-17  
**Environment:** `USE_MOCK_SERVICES=true` (local dev, no live DB/Redis)  
**Branch:** main  
**Commits tested:** Phase 0 + Phase 1 + Phase 2 integration

---

## Automated Test Results

```
pnpm --filter @smartshaadi/api test -- src/chat src/matchmaking

Test Files  4 passed (4)
Tests       45 passed (45)
```

| Suite | Tests | Result |
|-------|-------|--------|
| `matchmaking/requests/__tests__/service.test.ts` | 23 | ✅ All pass |
| `chat/socket/__tests__/handlers.test.ts` | 9 | ✅ All pass |
| `matchmaking/__tests__/engine.test.ts` | 6 | ✅ All pass |
| `matchmaking/__tests__/filters.test.ts` | 7 | ✅ All pass |

---

## Manual Smoke Checklist

> Tested against `USE_MOCK_SERVICES=true`. Live DB/Redis integration deferred to staging.

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | `POST /api/v1/matchmaking/requests` → 201 match request created | ⚠️ Not tested live | Requires PostgreSQL — mock mode skips DB; unit tests cover all guards |
| 2 | `PUT /api/v1/matchmaking/requests/:id/accept` → 200, Chat doc created | ⚠️ Not tested live | Chat.create guarded by USE_MOCK_SERVICES; mock path writes to mockStore |
| 3 | `GET /api/v1/chat/conversations` → 200, returns empty array | ✅ Mock returns `[]` | Confirmed via code review: mock guard returns `ok(res, [])` |
| 4 | `GET /api/v1/chat/conversations/:matchId` → 200, returns messages | ✅ Mock returns `{ messages: [], total: 0 }` | Confirmed via code review |
| 5 | `POST /api/v1/chat/conversations/:matchId/photos` → pre-signed URL | ⚠️ Not tested live | Requires R2 credentials; participant guard correctly bypassed in mock mode |
| 6 | Socket.io: connect to `/chat` with valid JWT → connected | ⚠️ Not tested live | JWT auth middleware uses `env.JWT_SECRET`; unit test mocks env |
| 7 | Socket.io: `join_room` → socket joins `matchRequestId` room | ✅ Unit tested | Mock mode bypasses participant check; real mode verifies Chat.participants |
| 8 | Socket.io: `send_message` → message in MongoDB + emitted to room | ✅ Unit tested | Mock mode skips Mongoose; `message_received` emitted to room in both paths |
| 9 | Web: `/chat/[matchId]` page loads, shows message history | ⚠️ Not tested live | Server Component fetches from API; requires running dev stack |
| 10 | Web: ChatInput sends message, appears in UI without refresh | ⚠️ Not tested live | Socket.io client wired; requires running dev stack |

---

## Integration Verification

### index.ts mount order ✅

```typescript
// Confirmed order in apps/api/src/index.ts:
const server = createServer(app)     // 1. http.Server wrap
initSocket(server)                    // 2. Socket.io attached
app.use('/api/v1/matchmaking', ...)  // 3. Match requests router (includes /requests sub-router)
app.use('/api/v1/chat', chatRouter)  // 4. Chat REST router
server.listen(env.PORT, ...)         // 5. Server starts
```

### Notification wiring ✅

| Trigger | Queue job | Status |
|---------|-----------|--------|
| `sendRequest` | `MATCH_REQUEST_RECEIVED` → receiverId | ✅ Wired in service.ts |
| `acceptRequest` | `MATCH_ACCEPTED` → senderId | ✅ Wired in service.ts |
| `send_message` (socket) | `NEW_CHAT_MESSAGE` → receiverId (if not in room) | ✅ Wired in handlers.ts Phase 2 |

---

## Known Gaps / Blockers

| Gap | Description | Planned Fix |
|-----|-------------|-------------|
| Hindi–English translation | `contentHi` / `contentEn` fields always `null` | Wire `POST /ai/chat/translate` in Week 5 / Phase 3 |
| `content.service.test.ts` | 11 pre-existing test failures (unrelated to Week 4) | Separate fix needed — pre-existed before Week 4 started |
| Live smoke test | Full checklist requires running dev stack (PostgreSQL + MongoDB + Redis + Next.js) | Run manually when `docker compose up` available |
| Push notification delivery | Bull jobs enqueued but no worker consumes `notifications` queue yet | Week 5: implement notification worker |
