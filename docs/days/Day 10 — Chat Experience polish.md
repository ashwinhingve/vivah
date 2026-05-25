Read first:
- apps/web/src/app/(app)/chat/page.tsx (chat list)
- apps/web/src/app/(app)/chat/[id]/page.tsx (individual chat)
- apps/web/src/components/chat/ (all chat components)
- apps/api/src/chat/socket/index.ts (understand Socket.io message shape)
- apps/api/src/infrastructure/mongo/models/Chat.ts (message types)
- packages/types/src/chat.ts

Day 10 — Chat experience deep polish.
The most generic-feeling screen currently. Needs to feel as polished
as iMessage or WhatsApp Web while keeping matrimonial premium feel.
NO plan approval. Plan 5 lines per task. Sequential commits.

═══════════════════════════════════════════════════════════════════════════
TASK 1 — CHAT LIST POLISH (2h)
═══════════════════════════════════════════════════════════════════════════

Current chat list: simple rows with avatar + name + last message + time.
Functional but flat. Needs visual hierarchy and "alive" feeling.

1. Chat list layout
   Two-column on desktop (chat list 360px | active chat fills remaining)
   Single column on mobile (list → tap → chat detail)

2. Chat list header
   "Conversations" Playfair 24px Burgundy
   Below: filter tabs:
     [All (N)] [Unread (N)] [Active (N)]
   - Active: Teal underline
   - Counts as small chips next to label
   - Use existing tab pattern from elsewhere in app

3. Search input
   Below tabs, full-width within sidebar:
   "Search by name..." with magnifying glass icon left
   Filters chat list in real-time

4. Chat row refinement
   Each row:
   ┌──────────────────────────────────────────────┐
   │ [avatar]  Riya Sharma            [2 min ago] │
   │           Hey, how's your week going?    [3] │
   └──────────────────────────────────────────────┘
   
   - Avatar: 48px circle (initialed avatar pattern if no photo)
   - Online dot: green 8px on bottom-right of avatar if active
   - Name: Inter 14px semibold Charcoal
   - Time: Inter 12px muted, top-right
   - Last message: Inter 13px muted, truncate to 1 line
   - Unread badge: Teal pill with count, bottom-right
   - "You: " prefix when last message was from current user, in muted Gold
   - Photo messages: show "📷 Photo" instead of content
   - System messages (video call): show "📹 Video call" muted italic
   
   On hover: subtle bg-warm-ivory tint
   On active (selected): bg-warm-ivory + Teal left-border 3px
   On unread: name in Inter bold, last message in Charcoal (not muted)

5. Empty state — no conversations
   EmptyState with NoMessagesIllustration
   "Start conversations with your matches"
   "Browse matches →" CTA to /feed

═══════════════════════════════════════════════════════════════════════════
TASK 2 — CHAT HEADER REFINEMENT (1.5h)
═══════════════════════════════════════════════════════════════════════════

Current: large "Video calls" section header takes too much vertical space.
The actual person you're chatting with feels secondary.

1. Active chat header (top of right column)
   ┌──────────────────────────────────────────────────────┐
   │ ← [avatar] Riya Sharma · 26              [🎥] [⋮]  │
   │            Online · Bhopal                            │
   └──────────────────────────────────────────────────────┘
   
   - Back arrow (mobile only, hidden md+)
   - Avatar: 40px (smaller than chat list rows)
   - Name + age: Inter 16px semibold, then comma age
   - Status line: Inter 12px muted ("Online" / "Last seen 2h ago" / "Offline · {city}")
   - Top-right: Video call icon (24px, Teal) + kebab menu
   - Border-bottom: Gold/20 1px
   - Sticky top of chat panel

2. Move video call section entirely
   Current dedicated "Video calls / Start an instant call or schedule one together"
   section is too prominent. Remove the entire section.
   
   Video call entry now happens via:
   - Top-right icon in header (one-click to start)
   - On click: opens small popover with "Start now" + "Schedule for later"
   - Schedule opens existing scheduler in a modal sheet

3. Translate toggle reposition
   Currently large "Translate Hindi → English" button top-right of message area.
   Move to chat input bar as a small icon toggle:
   - Globe icon, 16px, in the input bar utilities row
   - Active state: Teal fill
   - On toggle: persists per-conversation in Zustand
   - Tooltip: "Auto-translate Hindi messages to English"

═══════════════════════════════════════════════════════════════════════════
TASK 3 — MESSAGE BUBBLES POLISH (2.5h)
═══════════════════════════════════════════════════════════════════════════

Current message rendering is functional but generic.

1. Bubble styling
   Outgoing (current user):
   - Background: Teal (#0E7C7B)
   - Text: white
   - Border-radius: rounded-2xl with rounded-br-md (chat-bubble shape)
   - Max-width: 75% of chat area
   - Right-aligned with right margin
   - Time below in muted-white text (10:42 PM · ✓✓ Read)
   
   Incoming (other user):
   - Background: white
   - Border: Gold/20 1px
   - Text: Charcoal
   - Border-radius: rounded-2xl with rounded-bl-md
   - Max-width: 75%
   - Left-aligned with avatar on left (only for first message in cluster)
   - Time below in muted text

2. Message clustering
   Multiple messages from same sender within 2 minutes = visually cluster:
   - Only first message in cluster shows avatar
   - Subsequent messages: same alignment, slightly less margin-top (mt-1 vs mt-3)
   - Last message in cluster shows the timestamp
   - Time + read receipt appear below last message only

3. System messages (video call, match accepted, etc.)
   Center-aligned, full-width, distinct from regular bubbles:
   
   Video call message — refined chip from Day 8:
   ┌─────────────────────────────────┐
   │  📹  Video call started          │
   │  [Join Call] (Teal CTA)          │
   │  2 min ago · Tap to join         │
   └─────────────────────────────────┘
   - Gold/20 background, Burgundy text, centered
   - Max-width 320px
   
   Match accepted message:
   "🎉 You and Riya are now connected"
   Center-aligned Playfair italic Gold/80, no bubble

4. Photo messages
   Render image inline within the bubble:
   - Max 240px width
   - rounded-xl
   - Tap → fullscreen lightbox (same component as profile photo lightbox)
   - Below image: optional caption text
   - Loading state: skeleton shimmer at same dimensions

5. Date separators
   When date changes between messages, show separator:
   ── Today ──
   ── Yesterday ──
   ── Mon, 22 May ──
   Center-aligned, Inter 12px muted, with thin Gold/20 lines either side

6. Typing indicator
   When other user is typing:
   - Same alignment as their bubbles (left)
   - Three dots animating in sequence
   - "Riya is typing..." text in muted italic
   - Disappears after 3s of no activity or on next message

═══════════════════════════════════════════════════════════════════════════
TASK 4 — INPUT BAR REFINEMENT (1h)
═══════════════════════════════════════════════════════════════════════════

Current: text input with suggestion chips above and emoji/mic buttons.

1. Input bar layout
   ┌─────────────────────────────────────────────────────────┐
   │ [+] [Type a message...]                  [🌐] [😊] [🎤] │
   └─────────────────────────────────────────────────────────┘
   
   - [+] Attachment button (left), opens photo picker
   - Text input: flex-1, min-height 44px, max-height 120px (auto-grow)
   - [🌐] Translate toggle (from Task 2)
   - [😊] Emoji picker trigger
   - [🎤] Voice message (placeholder for future, hide for now)
   - When user types: [🎤] swaps to [→] send button (Teal)
   - All buttons 44px touch targets

2. Suggestion chips
   Current: large chips ABOVE input ("Tell me more about that!" etc.)
   These are too prominent and feel pushy.
   
   Refactor:
   - Show only on first message in a conversation
   - Show only 2-3 chips max
   - Smaller size (text-xs, py-1.5 px-3)
   - Muted styling (Gold/20 bg, Burgundy text)
   - Once user sends first message, hide chips for entire session
   - Add subtle "✨ AI suggestions" label above chips

3. Attachment menu
   When [+] tapped:
   - Slide-up sheet (mobile) or popover (desktop)
   - Options: Photo · Voice note (coming soon, disabled)
   - Photo: opens system picker, uploads via existing R2 flow

═══════════════════════════════════════════════════════════════════════════
VERIFICATION
═══════════════════════════════════════════════════════════════════════════

After all 4 tasks:
pnpm --filter @smartshaadi/web type-check → zero errors
pnpm --filter @smartshaadi/web build → succeeds

Visual QA:
□ Chat list has filter tabs, search, online dots, unread badges
□ Active chat header is compact, video call moved to icon
□ Translate is now an icon in input bar
□ Outgoing messages Teal, incoming white with Gold border
□ Message clustering works (avatar/time only on first/last)
□ System messages distinct from regular bubbles
□ Date separators appear when day changes
□ Input bar auto-grows on multi-line, send button swaps with mic
□ Suggestion chips only on first message, small, muted

Commits:
Commit 1: "feat(chat): polished chat list with filters, search, online indicators, unread counts"
Commit 2: "refactor(chat): compact header with video call as icon + translate as input toggle"
Commit 3: "polish(chat): premium message bubbles with clustering, system message variants, date separators"
Commit 4: "polish(chat): refined input bar with auto-grow, attachment menu, subtle AI suggestions"

git push origin main