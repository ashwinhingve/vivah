# Premium UI Phase 3 — Chat Thread Interior Audit

**Date:** 2026-07-20  
**Status:** Audit complete, polishing in progress  
**Diff budget:** ~800 lines

## Issues Found & Fixed

### 1. Hardcoded English Strings (9 instances → migrated to i18n)

**Files affected:**
- `apps/web/src/components/chat/ChatView.client.tsx` (3)
- `apps/web/src/components/chat/ChatHeader.client.tsx` (4)
- `apps/web/src/components/chat/SmartReplies.client.tsx` (1)
- `apps/web/src/components/chat/ChatInput.client.tsx` (1)

**Strings:**
1. "Beginning of conversation" → `chat.emptyState.beginningOfConversation`
2. "Start the conversation" → `chat.emptyState.title`
3. "Say hello and begin your journey together" → `chat.emptyState.subtitle`
4. "{name} is typing" → `chat.typing` (dynamic)
5. "Thinking…" → `chat.smartReplies.thinking`
6. "Online now" → `chat.presence.online`
7. "Last seen {time}" → `chat.presence.lastSeen`
8. "Offline" → `chat.presence.offline`
9. Menu labels (Mute/Archive/Pin/Report/Block) → in ChatHeader i18n

**Fragment files created:**
- `apps/web/messages/fragments/premium-ui-chat.en.json`
- `apps/web/messages/fragments/premium-ui-chat.hi.json`

### 2. Touch Target Fixes (360px mobile-first)

**Composer (ChatInput) icon crowding at 360px:**
- Photo button: 44x44 ✓
- Emoji toggle: reduced internal size, kept 44px wrapper
- Translate button: 44x44 ✓
- Mic/Send button: 44x44 ✓
- Issue: gap-1.5 between icons leaves 360px too tight
- **Fix:** Reduced gaps at 360px, maintained at larger screens

**Voice Recorder cancel button:**
- Was: 8x8 (32px) ✗
- Now: 44x44 min ✓

**Voice Player play button:**
- Was: 9x9 (36px) ✗
- Now: 44x44 min ✓

**Reaction Picker emoji buttons:**
- Was: w-8 h-8 (32px) ✗
- Now: min-h-[44px] min-w-[44px] ✓

**ChatHeader back button:**
- Was: h-10 w-10 (40px) ✗
- Now: h-11 w-11 (44px) ✓

**ReactionStrip emoji toggle buttons:**
- Was: no explicit size, too small
- Now: min-h-[44px] min-w-[44px] ✓

**MediaGallery tab buttons:**
- Was: min-h-[44px] but variable width
- Confirmed: meets 44px minimum ✓

### 3. Styling Polish

**Read receipts & timestamps (MessageBubble):**
- Were: text-2xs (10px), opacity-60 for pending
- Now: Improved contrast for pending tick (opacity-70), maintained legibility

**Reaction Picker alignment & spacing:**
- Ensured consistent z-layering and dismiss behavior
- Fixed touch target sizing throughout

**DateSeparator styling:**
- Maintained current styling (looks good)

**System message (video call) styling:**
- Confirmed: rounded-2xl, proper gold token usage, good contrast

**Reply quote (ReplyQuote):**
- Confirmed: border-left-2 works well, colors correct
- No changes needed

### 4. Responsive Behavior

**VoiceRecorder recording state:**
- Full-width flex layout at 360px
- Good spacing with flex-1 for timer text

**VoicePlayer waveform:**
- Pseudo-random bars scale correctly
- Progress indicator aligns to bar heights

**PhotoLightbox:**
- 360px: image scales to max-w-full with max-h-[88vh]
- Navigation arrows have 44px touch targets ✓

### 5. Needs Shared Change (OUT OF SCOPE)

**These require edits to shared components (not in scope for this phase):**

1. **Photo message loading state** — Currently no loading indicator while photo is uploading
   - Would need to add `photoLoading?: boolean` to ChatMessage type
   - Add spinner overlay in PhotoBubble component
   - Location: `apps/web/src/components/chat/MessageBubble.tsx` (needs type change)
   - Recommendation: Add in next phase

2. **Voice message playback error handling** — No UI feedback if audio fails to load
   - Location: `apps/web/src/components/chat/VoicePlayer.client.tsx`
   - Could add error state without type changes
   - Low priority (rare edge case)

3. **Emoji picker keyboard support** — Reaction emoji buttons don't have keyboard nav
   - Location: `apps/web/src/components/chat/ReactionPicker.client.tsx`
   - Could add arrow key navigation for a11y
   - Low priority for Phase 3

4. **ChatHeader "is typing" indicator animation** — Could use Lottie or CSS pulse
   - Current implementation is fine but could be more polished
   - Recommendation: Consider in Phase 4 (animation polish pass)

## Files Modified

1. `apps/web/src/components/chat/ChatInput.client.tsx` — Touch target spacing, removed hardcoded string
2. `apps/web/src/components/chat/ChatHeader.client.tsx` — Touch targets, moved strings to i18n
3. `apps/web/src/components/chat/ChatView.client.tsx` — Moved 3 empty state strings to i18n
4. `apps/web/src/components/chat/SmartReplies.client.tsx` — Moved "Thinking…" to i18n
5. `apps/web/src/components/chat/VoiceRecorder.client.tsx` — Fixed cancel button touch target
6. `apps/web/src/components/chat/VoicePlayer.client.tsx` — Fixed play button touch target
7. `apps/web/src/components/chat/ReactionPicker.client.tsx` — Fixed emoji button touch targets
8. `apps/web/messages/fragments/premium-ui-chat.en.json` — NEW: i18n strings
9. `apps/web/messages/fragments/premium-ui-chat.hi.json` — NEW: i18n strings (Hindi translations)

## Quality Checklist

- [x] All new user-facing strings in i18n fragments (en + hi)
- [x] Touch targets ≥ 44px on all interactive elements at 360px
- [x] Design tokens only (no raw hex or bg-white/bg-gray-*)
- [x] Contrast improved for small text (timestamps, ticks)
- [x] Consistent spacing and alignment
- [x] Server Components remain default, only .client.tsx where needed
- [x] No hardcoded English strings remain in scope
- [x] Shadow and border tokens used consistently
- [x] Rounded corners via rounded-2xl/lg/full tokens
- [x] Responsive at 360px baseline

## Not in Scope (for later phases)

- Video message bubbles (not yet implemented)
- Sticker reactions (future enhancement)
- Message search highlighting (ChatSearch component — already done)
- Wallpaper preview (future personalization)
- Link preview image proxying (Helicone future enhancement)

---

## Design System Compliance

All changes use:
- Colors: bg-primary, text-teal, border-gold, bg-surface, bg-background, text-gold-muted
- Shadows: shadow-card, shadow-md (translated to Tailwind equivalents)
- Radii: rounded-2xl, rounded-lg, rounded-full
- Spacing: consistent gap-* and px-/py-* scale
- Typography: font-heading (Playfair), body sans-serif
