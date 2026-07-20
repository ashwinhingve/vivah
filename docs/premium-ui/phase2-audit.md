# Premium UI Phase 2 — Live Audit (Core Matchmaking Journey)

Audited 2026-07-20 on `feat/premium-ui-phase-1`, live dev servers, Playwright at 375×812 and 1280×800,
logged in as QA user Aditya Deshmukh (+917000000001). Screenshots in `audit/` (gitignored).

Test-data fixes made during the audit (local only):
- `packages/db/seed/test-accounts.ts` — QA photo keys were `qa/photos/…`, a prefix the media router
  404s (fail-closed allowlist). Changed to `photos/qa/…` + backfilled existing rows via SQL + copied
  portrait files into `apps/api/.data/mock-r2/photos/qa/`. Feed/profile photos now load.
- Inserted match requests (2 received, 1 sent), 1 accepted match, 2 shortlist rows for the QA user.
- Note: seed portrait PNGs are 400×500 flat-colour placeholders; fine for layout work, but real
  portrait assets would make future before/after screenshots far more convincing.

## Cross-cutting findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| C1 | **Bug** | Hydration mismatch on /chats: `ConversationListItem` renders timestamps server-side (UTC) that differ from client locale ("11:13 am" vs "04:43 pm"). React regenerates the tree on every visit. | Format time on the client only (mounted gate) or pin timezone; component: `components/chat/` conversation list item. |
| C2 | **Bug** | Accept-request modal promises "They'll see it as the first message in your chat" but the welcome note never appears in the chat (thread shows "Start the conversation", list preview shows "—"). | Trace accept handler → chat doc creation; either post `acceptance_message` as first message or reword the modal. |
| C3 | High | `/requests`, `/likes`, `/shortlist` have no `generateMetadata` — browser tab shows the generic marketing title. | Add per-page metadata like /chats, /matches have. |
| C4 | Med | DemoPill (fixed bottom-left) overlaps interactive UI: feed filter section, chat composer, shortlist cards. Dev-only but constantly in the way of verification. | Reposition (e.g. top-center, `pointer-events-none` wrapper except close), keep below nav z-index. |
| C5 | Med | Empty states use generic circle icons though branded illustrations exist in `components/ui/illustrations/` (NoMessages, NoMatches, NoShortlist…). Dashboard events/conversations, chats list all generic. | Wire the illustration set into each page's EmptyState. |
| C6 | Low | `/welcome` continue button briefly renders with no accessible name pre-hydration. | Give the button static text/aria-label server-side. |

## Dashboard (`(app)/dashboard`)

Strengths: hero greeting + date pill, animated stat numbers, completeness card with section pills,
Today's Matches rail, My Wedding card. Solid foundation.

- **D1 (mobile)**: 4 stat cards stack full-width → ~700px of scroll before content. Make 2×2 grid (`grid-cols-2`) at base.
- **D2**: Today's Matches card action row: bookmark button clipped at card edge (both widths — see screenshots). Rework action row to fit (`Send Interest` + bookmark within card width).
- **D3**: Profile completeness appears 3× on one screen (hero progress bar, PROFILE stat card, completeness card). Drop the hero bar; keep stat + card.
- **D4**: Empty states (events, conversations) → branded illustrations + CTA (C5).
- **D5**: StatsCard hover: add shadow-card-hover lift + faint gold glow; quick-action cards likewise.
- **D6 (mobile)**: Quick Actions: 4 stacked full-width rows → 2×2 grid.

## Feed (`(app)/feed`)

Strengths: strong card design (score chip, Verified/NEW badges, gradient name overlay), clear
action row (pass/connect/save), filter sidebar + mobile sheet, sort select.

- **F1 (bug)**: "MARITAL STATUS" section label rendered twice, stacked, in the filter sidebar.
- **F2**: Cards in the same row misalign when one has an extra pill (Non-Manglik): action rows land at different heights. Reserve a fixed-height pill row.
- **F3**: "18/36 Guna" chip: muted grey-on-surface over gold photo — weak contrast, and Guna deserves brand treatment (gold token).
- **F4 (mobile)**: pre-card header stack (title/subtitle, complete-pill + refine + refresh, filters + sort) ≈ 260px tall. Compress to two rows.
- **F5**: No layout-matched loading skeleton for the card grid (loading.tsx is generic RouteSkeleton).
- **F6**: Desktop card hover: image scale exists; add shadow-card-hover + subtle ring for premium feel.

## Profile detail (`(app)/profiles/[profileId]`)

Strengths: two-column layout, compatibility card with 7-dimension bars, tabbed detail sections,
verified banner, contact-hidden reassurance, sticky action bar.

- **P1 (bug)**: Thumbnail strip renders 6 slots for a 2-photo profile — 4 show broken-image dashes. Render only real photos.
- **P2 (bug)**: "Guna Milan — calculating…" shown permanently next to fully-rendered dimension bars (QA profiles have horoscope data; the label never resolves). Show score or an honest pending state.
- **P3 (bug/data)**: Hero pill says "Non-Manglik" while About tab says "MANGLIK Yes" for the same profile. Trace mapping (likely two different fields/decodings).
- **P4**: Locked "Why we matched you" rows are blurred grey bars that read as broken skeletons. Restyle as deliberate locked rows (lock glyph + label) above the upgrade card.
- **P5**: No photo lightbox — wire existing `PhotoLightboxModal.client.tsx` (zoom, swipe, ESC), fixing its 4 `bg-white` violations in passing.
- **P6**: Compatibility ring + score: static. Count-up via `AnimatedNumber`, tier-coloured glow.
- **P7 (mobile)**: Tab bar clips ("Hor…") with no scroll affordance — add fade-edge / scroll-snap.
- **P8**: Bio quote duplicated (hero card + About tab intro). Keep hero only.
- **P9**: "You may also like" card gradient too weak on light photos — name barely legible; strengthen overlay, add hover lift.

## Chats list (`(app)/chats`)

- **L1**: C1 hydration bug lives here.
- **L2**: Chat with no messages previews as "—" (and per C2 the welcome note is missing). Fallback: "Say hello 👋".
- **L3**: Filter pills (All/Unread/Archived) ~30px tall — below 44px touch target.
- **L4**: Rows: add hover/active background, stronger unread treatment (solid teal badge), slightly larger avatar; first-name-only "Sneha · 27" is good.
- **L5**: No layout-matched skeleton.

## Chat thread (`(app)/chat/[matchId]`)

- **T1 (critical layout)**: "Virtual dates" scheduling panel (date input, two selects, CTA, empty-state box) renders ABOVE the chat header. On 375px it consumes ~55% of the viewport before the conversation. Move into a header icon → sheet/dialog (`VirtualDates.client.tsx`).
- **T2 (bug)**: First smart-reply chip ("Hi! Lovely to match with you 🌸") renders solid destructive-red; siblings are teal/amber outline. Unify chip style on brand tokens.
- **T3**: Desktop: messages + composer span the full 1280px; constrain thread to a readable centered column (~max-w-3xl).
- **T4**: Composer: right icon cluster (emoji, translate, mic) crowds the input on 375px; photo button left. Rebalance; ensure 44px targets.
- **T5**: `MessageBubble.tsx:227` uses `bg-white/20` (token violation) — fix in passing.
- **T6**: Sent bubble: teal with white text is good; timestamps + read-check tiny grey — slightly increase contrast.

## Matches (`(app)/matches`)

- **M1**: Card: "Matched" badge + "Matched on 20 Jul 2026" redundant — keep badge, tuck date into tooltip/secondary line.
- **M2**: No skeleton; add card-shaped skeleton.
- **M3**: Fine otherwise — most polished page of the set.

## Requests (`(app)/requests`)

Strengths: tab switcher with counts, message quote treatment, accept modal with welcome note, Past requests accordion.

- **R1**: Recency row "3m ago · Active 1d ago" reads as contradiction. Label the first: "Sent 3m ago".
- **R2**: Accept flow feedback: after accepting, the card stays until reload shows change; add optimistic removal + success toast ("It's a match! Say hello →" linking to chat).
- **R3 (desktop)**: single narrow column wastes width; allow 2-col grid ≥lg.
- **R4**: C3 metadata title.

## Likes (`(app)/likes`)

- **K1**: Locked-state blurred placeholder cards have a cool teal-grey tint — off-brand against warm ivory; use warm blur tones and 3 evenly-composed placeholder cards.
- **K2**: "2 people like you" + lock card is good; add subtle gold-glow on the Upgrade button (premium moment).
- **K3**: C3 metadata title; skeleton for unlocked grid.

## Shortlist (`(app)/shortlist`)

- **S1**: Cards are photo+name only. Add: remove-from-shortlist button (with confirm toast), the saved note (seeded "Family background matches" is never shown), guna/compat chip, last-active.
- **S2**: C3 metadata title; skeleton; hover lift to match feed cards.

## Chunk mapping

- **Chunk 1 (dashboard + foundations)**: D1–D6, C3–C6, L3 pattern (shared 44px pill tab component if trivial).
- **Chunk 2 (feed + profile)**: F1–F6, P1–P9.
- **Chunk 3 (lists + chat)**: C1, C2 (investigate), L1–L5, T1–T6, M1–M2, R1–R4, K1–K3, S1–S2.
