# Week 4 — Match Requests + Real-Time Chat: Agent Teams Plan
# VivahOS Infinity · Phase 1 · Days 16–20
# Execution mode: Single Agent (Phase 0) → Agent Team (Phase 1 + 2)

> Phase 0 is mandatory — Mongoose connection, Chat model, and Socket.io
> must be committed before any teammate spawns. Zero file overlap guaranteed
> across all three teammates. No plan approval mode — teammates plan briefly
> in first message then implement immediately (WSL lesson from Week 3).

---

## Morning Checklist (7:00–8:00)

```bash
# 1. Read current status
cat CLAUDE.md | head -30

# 2. Confirm week target
grep -A10 "Week 4" ROADMAP.md

# 3. Update CLAUDE.md
# Phase: 1 | Week: 4 | Focus: Match Requests + Chat | Status: Starting

# 4. Start infrastructure
docker compose up -d

# 5. Start all services
pnpm dev

# 6. Confirm Agent Teams enabled
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS  # must print 1
```

---

## ─── PHASE 0: Single Agent Session (8:00–9:30) ───────────────────────────

> One agent. No teammates. Three jobs only. Commit before Phase 1.
> Purpose: wire Mongoose, create Chat model, install Socket.io.
> These touch shared infrastructure — never safe to parallelise.

### Research prompt (8:00–8:20)

```
Read these files fully before touching anything:
- apps/api/src/infrastructure/mongo/models/     (what models exist)
- apps/api/src/infrastructure/redis/index.ts    (Redis client setup)
- apps/api/src/infrastructure/redis/queues.ts   (Bull queue setup)
- apps/api/src/index.ts                         (what's mounted)
- apps/api/package.json                         (what's installed)
- packages/db/schema/index.ts lines 335–360     (match_requests table)
- docs/DATABASE.md MongoDB chats collection     (schema reference)

Summarise what exists. List exactly what Phase 0 must create.
Do NOT write any code yet.
```

### Phase 0 jobs (8:20–9:30)

#### Job 1 — Install dependencies
```bash
cd /mnt/d/Do\ Not\ Open/vivah/vivahOS
pnpm --filter @vivah/api add mongoose socket.io
pnpm --filter @vivah/api add -D @types/mongoose
```

#### Job 2 — Wire Mongoose connection
Create `apps/api/src/infrastructure/mongo/index.ts`:
```typescript
import mongoose from 'mongoose'
import { env } from '../../lib/env.js'

let isConnected = false

export async function connectMongo(): Promise<void> {
  if (isConnected) return
  await mongoose.connect(env.MONGODB_URI)
  isConnected = true
  console.log('MongoDB connected')
}

export { mongoose }
```

Add `connectMongo()` call in `apps/api/src/index.ts` before `app.listen()`:
```typescript
import { connectMongo } from './infrastructure/mongo/index.js'
await connectMongo()
```

#### Job 3 — Create Chat Mongoose model
Create `apps/api/src/infrastructure/mongo/models/Chat.ts`:
```typescript
import { mongoose } from '../index.js'

const MessageSchema = new mongoose.Schema({
  senderId:         { type: String, required: true },
  content:          { type: String, required: true },
  contentHi:        { type: String },              // Hindi translation
  contentEn:        { type: String },              // English translation
  type:             { type: String, enum: ['TEXT', 'PHOTO', 'SYSTEM'], default: 'TEXT' },
  photoKey:         { type: String },              // R2 key if type === PHOTO
  sentAt:           { type: Date, default: Date.now },
  readAt:           { type: Date },
  readBy:           [{ type: String }],
})

const ChatSchema = new mongoose.Schema({
  participants:     [{ type: String, required: true }],  // Two profile IDs
  matchRequestId:   { type: String, required: true, unique: true },
  messages:         [MessageSchema],
  lastMessage: {
    content:        { type: String },
    sentAt:         { type: Date },
    senderId:       { type: String },
  },
  isActive:         { type: Boolean, default: true },
}, { timestamps: true })

ChatSchema.index({ participants: 1 })
ChatSchema.index({ matchRequestId: 1 })

export const Chat = mongoose.model('Chat', ChatSchema)
```

#### Job 4 — Add shared types
Add to `packages/types/src/chat.ts` (CREATE):
```typescript
export interface ChatMessage {
  _id:        string
  senderId:   string
  content:    string
  contentHi:  string | null
  contentEn:  string | null
  type:       'TEXT' | 'PHOTO' | 'SYSTEM'
  photoKey:   string | null
  sentAt:     string
  readAt:     string | null
  readBy:     string[]
}

export interface ChatConversation {
  matchRequestId: string
  participants:   string[]
  messages:       ChatMessage[]
  lastMessage:    { content: string; sentAt: string; senderId: string } | null
  isActive:       boolean
}

export interface SocketEvents {
  // Client → Server
  join_room:    { matchRequestId: string }
  send_message: { matchRequestId: string; content: string; type: 'TEXT' | 'PHOTO'; photoKey?: string }
  mark_read:    { matchRequestId: string; messageIds: string[] }
  typing:       { matchRequestId: string }
  // Server → Client
  message_received: ChatMessage
  message_read:     { messageIds: string[]; readBy: string }
  user_typing:      { userId: string }
  match_accepted:   { matchRequestId: string }
}
```

Add barrel export:
```
packages/types/src/index.ts → add: export * from './chat.js'
```

#### Phase 0 commit (9:30)
```bash
pnpm --filter @vivah/types build
pnpm type-check   # zero errors required
git add -A
git commit -m "feat(infra,types): mongoose connection + chat model + socket.io install + chat types"
git push origin main
```

> ✅ STOP. Do not write any request or chat logic. Agent Team takes over.

---

## ─── PHASE 1: Agent Team — Core Build (9:30–12:30) ──────────────────────

> Paste this prompt verbatim into Claude Code after Phase 0 commit.
> NO plan approval. Each teammate plans in first message then implements.

### Team spawn prompt

```
We are building Week 4 of VivahOS Infinity — match requests state machine
and real-time chat. Phase 0 is complete and committed:
- Mongoose connected, Chat model at apps/api/src/infrastructure/mongo/models/Chat.ts
- Socket.io installed in apps/api/package.json
- Shared types at packages/types/src/chat.ts

Create an agent team with exactly 3 teammates.
NO plan approval required — each teammate writes a 3-line plan in their
first message then begins implementation immediately.

Quality bar for all teammates:
- TypeScript strict — no any, no shortcuts
- API envelope: { success, data, error, meta } always
- All DB queries filtered by userId — never expose another user's data
- authenticate() middleware on every protected endpoint
- pnpm type-check must pass before marking any task complete
- Git checkpoint before risky operations

─── TEAMMATE 1: match-requests ───────────────────────────────────────────────
Domain: apps/api/src/matchmaking/requests/
Files you OWN (no other teammate touches these):
  - apps/api/src/matchmaking/requests/service.ts       (CREATE)
  - apps/api/src/matchmaking/requests/router.ts        (CREATE)
  - apps/api/src/matchmaking/requests/__tests__/service.test.ts  (CREATE)

Context you need — read these first:
  - packages/db/schema/index.ts lines 335–380 (match_requests, blocked_users)
  - apps/api/src/matchmaking/router.ts (existing feed/score endpoints — do NOT modify)
  - apps/api/src/auth/middleware.ts
  - apps/api/src/lib/response.ts
  - apps/api/src/infrastructure/redis/queues.ts (for notifications queue)
  - docs/API.md matchmaking section

Your tasks in order:
1. service.ts — full match request state machine:
   sendRequest(senderId, receiverId, message?) 
     → check not blocked, check no existing request, insert match_request
     → push notification job to queue:notifications
   acceptRequest(userId, requestId)
     → verify userId === receiver_id, update status ACCEPTED
     → push notification: MATCH_ACCEPTED to sender
     → create empty Chat document in MongoDB (matchRequestId = requestId)
   declineRequest(userId, requestId)
     → verify userId === receiver_id, update status DECLINED
   withdrawRequest(userId, requestId)
     → verify userId === sender_id, update status WITHDRAWN
   blockUser(userId, targetProfileId)
     → insert blocked_users record
     → update any PENDING match_request between them to BLOCKED
   reportUser(userId, targetProfileId, reason)
     → insert into audit_logs (event_type: PROFILE_REPORTED)
   getReceivedRequests(userId, page, limit)
   getSentRequests(userId, page, limit)

2. Write service.test.ts BEFORE implementing each function:
   - sendRequest: duplicate guard, blocked user guard, success case
   - acceptRequest: wrong user rejected, success + Chat created
   - declineRequest: wrong user rejected, success
   - blockUser: blocks both directions, updates pending requests
   - getReceivedRequests: pagination correct, only own requests returned

3. router.ts — mount these endpoints (all authenticate()):
   POST   /requests              → sendRequest
   PUT    /requests/:id/accept   → acceptRequest
   PUT    /requests/:id/decline  → declineRequest
   DELETE /requests/:id          → withdrawRequest
   POST   /block/:profileId      → blockUser
   POST   /report/:profileId     → reportUser (body: { reason: string })
   GET    /requests/received     → getReceivedRequests
   GET    /requests/sent         → getSentRequests

4. Mount router in apps/api/src/matchmaking/router.ts:
   Import and use: app.use('/api/v1/matchmaking', requestsRouter)
   Add AFTER existing routes — do not touch existing feed/score endpoints.

5. pnpm type-check && pnpm --filter @vivah/api test
6. Commit: feat(matchmaking): match request state machine + block + report

─── TEAMMATE 2: socket-server ────────────────────────────────────────────────
Domain: apps/api/src/chat/socket/
Files you OWN (no other teammate touches these):
  - apps/api/src/chat/socket/index.ts             (CREATE)
  - apps/api/src/chat/socket/handlers.ts          (CREATE)
  - apps/api/src/chat/socket/__tests__/handlers.test.ts (CREATE)

Context you need — read these first:
  - apps/api/src/index.ts (Express server setup — you will modify this)
  - apps/api/src/infrastructure/mongo/models/Chat.ts
  - apps/api/src/infrastructure/redis/index.ts
  - apps/api/src/lib/env.ts (JWT_ACCESS_SECRET for socket auth)
  - packages/types/src/chat.ts (SocketEvents interface)
  - docs/ARCHITECTURE.md Real-Time Chat Architecture section

Your tasks in order:
1. socket/index.ts — Socket.io server setup:
   - Create Socket.io server attached to existing Express http.Server
   - Namespace: /chat
   - Auth middleware: verify JWT from handshake.auth.token
     Extract userId and profileId from token
     Reject connection if invalid
   - Export: initSocket(server: http.Server) → Server

2. socket/handlers.ts — event handlers:
   join_room: 
     → verify user is participant in the matchRequest (check MongoDB Chat doc)
     → socket.join(matchRequestId)
   send_message:
     → verify sender is participant
     → append message to Chat.messages in MongoDB
     → update Chat.lastMessage
     → emit message_received to all in room
     → if receiver not in room: push Bull job to queue:notifications
   mark_read:
     → update readAt + readBy on messages in MongoDB
     → emit message_read to room
   typing:
     → emit user_typing to room (broadcast — exclude sender)

3. Write handlers.test.ts:
   - join_room: non-participant rejected
   - send_message: message persisted to MongoDB, event emitted
   - mark_read: readAt set correctly
   - typing: not emitted back to sender

4. Modify apps/api/src/index.ts:
   - Wrap app.listen() with http.createServer(app)
   - Call initSocket(server) after server creation
   - Import from './chat/socket/index.js'

5. pnpm type-check && pnpm --filter @vivah/api test
6. Commit: feat(chat): socket.io server + namespace + jwt auth + message handlers

─── TEAMMATE 3: chat-api + ui ────────────────────────────────────────────────
Domain: apps/api/src/chat/router/ + apps/web chat pages
Files you OWN (no other teammate touches these):
  - apps/api/src/chat/router.ts                   (CREATE)
  - apps/web/src/app/(chat)/layout.tsx            (CREATE)
  - apps/web/src/app/(chat)/[matchId]/page.tsx    (CREATE)
  - apps/web/src/app/(chat)/[matchId]/loading.tsx (CREATE)
  - apps/web/src/components/chat/MessageBubble.tsx (CREATE)
  - apps/web/src/components/chat/ChatInput.client.tsx (CREATE)

Context you need — read these first:
  - apps/api/src/infrastructure/mongo/models/Chat.ts
  - apps/api/src/auth/middleware.ts
  - apps/api/src/lib/response.ts
  - packages/types/src/chat.ts
  - docs/API.md chat section
  - .claude/commands/ui-component.md (design system rules)

IMPORTANT: Start Phase A (UI) immediately. Phase B (router) can run in parallel.
Do both — they share no files.

Phase A — Chat UI:
1. MessageBubble.tsx — Server Component:
   - Sent messages: right-aligned, bg-[#0E7C7B] text-white rounded-xl
   - Received: left-aligned, bg-white border border-[#C5A47E]/20 rounded-xl
   - Timestamp below bubble in text-[#6B6B76] text-xs
   - Photo message: show image with R2 pre-signed URL
   - System message: centered, text-[#6B6B76] italic text-sm

2. ChatInput.client.tsx — Client Component ('use client'):
   - Textarea: auto-resize, max 4 rows, min-h-[44px]
   - Send button: bg-[#0E7C7B] min-h-[44px] min-w-[44px]
   - Typing indicator emit on keystroke (debounced 500ms)
   - Photo upload button → triggers R2 pre-signed URL flow
   - Connects to Socket.io /chat namespace
   - Emits send_message on submit
   - Listens: message_received, user_typing, message_read

3. [matchId]/page.tsx — Server Component:
   - Fetch conversation history from GET /api/v1/chat/conversations/:matchId
   - Render MessageBubble for each message
   - Render ChatInput.client.tsx at bottom
   - Other participant's name + photo in header (Warm Ivory #FEFAF6 bg)

4. loading.tsx: skeleton bubbles alternating left/right with animate-pulse

Phase B — REST endpoints:
5. router.ts:
   GET  /conversations          → list all conversations for userId (lastMessage, participant info)
   GET  /conversations/:matchId → full message history (paginated, newest first)
   POST /conversations/:matchId/photos → return R2 pre-signed URL for photo upload

6. Mount in apps/api/src/index.ts — add line:
   app.use('/api/v1/chat', chatRouter)
   (Coordinate with Teammate 2 — both touch index.ts. 
    Message Teammate 2 to confirm their index.ts changes before you add your line)

7. pnpm type-check && pnpm --filter @vivah/web build
8. Commit: feat(chat): chat REST API + chat UI components + message bubbles

─── SHARED RULES ─────────────────────────────────────────────────────────────
- Never touch a file owned by another teammate
- index.ts coordination: Teammate 2 modifies first (http.Server wrap + initSocket)
  Teammate 3 adds chat router mount AFTER Teammate 2 commits
- Message each other directly if blocked — do not wait for lead
- /compact when context hits 70%
- Mark task complete in shared task list immediately after commit
```

---

## ─── PHASE 2: Integration (13:00–16:00) ─────────────────────────────────

> After lunch. Single agent handles integration — shut team down first.

### Shutdown prompt
```
Ask all teammates to shut down gracefully. Then clean up the team.
```

### Phase 2 single agent prompt
```
Read these files that landed in Phase 1:
- apps/api/src/matchmaking/requests/service.ts
- apps/api/src/chat/socket/handlers.ts
- apps/api/src/chat/router.ts
- apps/api/src/index.ts

Then do these integration tasks:

1. Verify index.ts has all three mounts in correct order:
   - http.createServer(app) wrapping app.listen
   - initSocket(server) called
   - app.use('/api/v1/matchmaking', ...) 
   - app.use('/api/v1/chat', chatRouter)
   Fix ordering if wrong.

2. Wire notification jobs in requests/service.ts:
   acceptRequest → push to queue:notifications:
   { userId: senderId, type: 'push', title: 'Match Accepted!', 
     body: '{name} accepted your match request', data: { matchRequestId } }

3. Wire notification in socket handlers.ts:
   send_message → if receiver not in room → push to queue:notifications:
   { userId: receiverId, type: 'push', title: 'New message',
     body: 'You have a new message', data: { matchRequestId } }

4. Smoke test checklist (run manually against local dev):
   □ POST /api/v1/matchmaking/requests → 201 match request created
   □ PUT /api/v1/matchmaking/requests/:id/accept → 200, Chat doc created in MongoDB
   □ GET /api/v1/chat/conversations → 200, returns conversation list
   □ GET /api/v1/chat/conversations/:matchId → 200, returns messages array
   □ Socket.io: connect to /chat with valid JWT → connected
   □ Socket.io: join_room → socket joins matchRequestId room
   □ Socket.io: send_message → message appears in MongoDB + emitted to room
   □ Web: /chat/[matchId] page loads, shows message history
   □ Web: ChatInput sends message, appears in UI without refresh

5. pnpm type-check && pnpm test
6. Document failures in docs/smoke-test-week4.md
```

---

## ─── Session End (17:30–18:00) ──────────────────────────────────────────

```bash
pnpm type-check && pnpm test

git add -A
git commit -m "feat(chat): week 4 complete — match requests + socket.io + real-time chat"
git push origin main
```

Update ROADMAP.md — mark done:
```
✅ Match requests: send, accept, decline, withdraw
✅ Match requests: block and report  
✅ Match requests: contact visibility controls
✅ Real-time chat: Socket.io server setup
✅ Real-time chat: message persistence (MongoDB)
✅ Real-time chat: photo sharing (R2 pre-signed)
✅ Real-time chat: read receipts
```

Add blocker note:
```
[2026-week4] Hindi-English translation not wired — 
POST /ai/chat/translate endpoint needed in ai-service.
Chat model has contentHi/contentEn fields ready.
Wire in Week 5 or Phase 3.
```

Update CLAUDE.md:
```
Phase:  1
Week:   5
Focus:  Vendors + Booking + Payments
Status: Starting
```

---

## File Ownership Map

| File | Owner | Phase |
|------|-------|-------|
| `infrastructure/mongo/index.ts` | Single agent | Phase 0 |
| `infrastructure/mongo/models/Chat.ts` | Single agent | Phase 0 |
| `packages/types/src/chat.ts` | Single agent | Phase 0 |
| `matchmaking/requests/service.ts` | Teammate 1 | Phase 1 |
| `matchmaking/requests/router.ts` | Teammate 1 | Phase 1 |
| `matchmaking/requests/__tests__/` | Teammate 1 | Phase 1 |
| `chat/socket/index.ts` | Teammate 2 | Phase 1 |
| `chat/socket/handlers.ts` | Teammate 2 | Phase 1 |
| `chat/socket/__tests__/` | Teammate 2 | Phase 1 |
| `chat/router.ts` | Teammate 3 | Phase 1 |
| `web/src/app/(chat)/` | Teammate 3 | Phase 1 |
| `web/src/components/chat/` | Teammate 3 | Phase 1 |
| `apps/api/src/index.ts` | Teammate 2 first, Teammate 3 after commit | Phase 1 |

---

## Dependency Chain

```
Phase 0 (single agent)
  └── Mongoose + Chat model + Socket.io + chat types committed
        ├── Teammate 1 (independent — starts immediately)
        ├── Teammate 2 (independent — starts immediately)
        └── Teammate 3 (Phase A UI — starts immediately)
              └── Teammate 3 Phase B router — starts immediately (no dependency)
                    └── index.ts mount — AFTER Teammate 2 commits http.Server wrap
```

---

## index.ts Coordination Protocol

This is the only shared file. Strict order:

```
1. Teammate 2 modifies index.ts first:
   - Wrap with http.createServer()
   - Add initSocket(server)
   - Commits

2. Teammate 3 pulls latest, then adds:
   - app.use('/api/v1/chat', chatRouter)
   - Commits

3. Single agent in Phase 2 verifies final state
```

Teammates must message each other directly on this:
```
Teammate 2 → Teammate 3: "index.ts committed, your mount is safe to add"
Teammate 3 → Teammate 2: "confirmed, adding chat router mount now"
```

---

## WSL Agent Teams Rules (Learned from Week 3)

```
✅ No plan approval mode — teammates die waiting for approval in WSL
✅ Each teammate plans in 3 lines then implements immediately  
✅ If teammate goes idle after planning — respawn with "claim task X, no plan mode"
✅ watch -n 3 "ls -la [dir]" in second terminal to monitor file activity
✅ Check task list JSON directly: cat ~/.claude/tasks/*/tasks.json
✅ 3 teammates maximum — sweet spot for Max 5x token budget
```

---

## Test Coverage Requirements

| Module | Required | Key Cases |
|--------|----------|-----------|
| `requests/service.ts` | 85%+ | Duplicate guard, wrong-user reject, bilateral block |
| `socket/handlers.ts` | 80%+ | Non-participant reject, message persist, typing broadcast |
| `chat/router.ts` | Integration | Auth, pagination, pre-signed URL format |
| Chat UI components | Visual | 375px width, 44px touch targets, Ivory background |
