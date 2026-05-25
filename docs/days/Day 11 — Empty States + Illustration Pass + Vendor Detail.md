Read first:
- apps/web/src/components/ui/illustrations/ (all 6 existing illustrations)
- apps/web/src/components/ui/EmptyState.tsx
- All empty state usages across the app
  (grep "EmptyState" -r apps/web/src to find call sites)
- apps/web/src/app/(app)/vendors/page.tsx (vendor list)
- apps/web/src/app/(app)/vendors/[id]/page.tsx (vendor detail)
- apps/web/src/components/vendor/ (vendor components)

Day 11 — Empty states unification + vendor detail polish.
NO plan approval. Plan 5 lines per task. Sequential commits.

═══════════════════════════════════════════════════════════════════════════
TASK 1 — ILLUSTRATION FAMILY CONSISTENCY PASS (3h)
═══════════════════════════════════════════════════════════════════════════

Current: 6 custom SVG illustrations from Day 1 foundation work.
Audit all 6 against each other — they need to feel like the same illustrator.

1. Open all 6 illustrations side-by-side at /ui-preview
   NoMatchesIllustration · NoMessagesIllustration · NoBookingsIllustration
   NoVendorsIllustration · NoWeddingPlanIllustration · NoTasksIllustration

2. Style audit checklist — every illustration must:
   - Use stroke-width: 1.5 consistently
   - Use rounded line-caps (stroke-linecap="round")
   - Use the same color palette: Gold #C5A47E primary, Burgundy #7B2D42 accent
   - Be 120×120px viewBox (or scale-safe equivalent)
   - Have transparent backgrounds
   - Use no fills except for the accent details (small dots, circles)
   - Feel "loose and friendly" not "geometric and rigid"

3. Common issues to fix:
   - If any illustration has different stroke widths → normalize to 1.5
   - If any uses pure black or saturated colors → swap to brand palette
   - If any has filled shapes where outline would fit → convert to outline
   - If any feels visually heavier than others → reduce detail
   
4. Add 4 new illustrations to complete the set:
   
   NoNotificationsIllustration — a small bell with three small dots above
   indicating silence, Gold accent
   
   NoShortlistIllustration — a bookmark shape, slightly tilted,
   Gold accent on the corner
   
   NoSearchResultsIllustration — a magnifying glass with a small question
   mark inside the lens, Gold accent
   
   NoNetworkIllustration — three small circles connected by dotted lines,
   one circle slightly faded (offline feel), Gold accent on the active circle

5. Update apps/web/src/components/ui/illustrations/index.ts barrel
   Export all 10 illustrations

6. Update /ui-preview to render all 10 in a grid for QA

═══════════════════════════════════════════════════════════════════════════
TASK 2 — EMPTY STATE COVERAGE AUDIT (2h)
═══════════════════════════════════════════════════════════════════════════

Walk every list/grid/feed in the app. Each one must have a proper empty state.

1. Audit script — grep for all list rendering patterns:
   grep -r "EmptyState" apps/web/src
   grep -r ".map(" apps/web/src/app
   Look for arrays that could be empty without EmptyState fallback.

2. Required empty states per route:
   /feed (no matches) → NoMatchesIllustration + "Refine preferences"
   /chat (no conversations) → NoMessagesIllustration + "Browse matches"
   /chat/[id] (no messages) → small inline empty state, not full EmptyState
       "Send the first message to start a conversation"
   /vendors (no search results) → NoSearchResultsIllustration + "Adjust filters"
   /vendors (no vendors at all) → NoVendorsIllustration
   /bookings (none) → NoBookingsIllustration + "Browse vendors"
   /weddings (none) → NoWeddingPlanIllustration + "Plan your first wedding"
   /weddings/[id]/guests (empty) → NoTasksIllustration + "Add or import guests"
   /weddings/[id]/tasks (empty) → NoTasksIllustration + "Add wedding tasks"
   /shortlist (empty) → NoShortlistIllustration + "Browse matches"
   /notifications (empty) → NoNotificationsIllustration + "You're all caught up"
   /requests (none received) → NoMessagesIllustration + "Wait for incoming interest"
   /requests (none sent) → NoMessagesIllustration + "Send interest from matches"
   /shop (no products) → NoVendorsIllustration + "Vendors haven't listed yet"
   /shop/orders (no orders) → NoBookingsIllustration + "Browse store"
   /admin/vendors (queue empty) → "All clear" with green check
   /admin/disputes (none) → "No disputes" with green check

3. Add missing empty states.
   Each must include:
   - Appropriate illustration
   - Playfair heading (one short sentence)
   - Inter subtext (one short explanation)
   - Primary CTA button (Teal, links to where they can take action)
   - Secondary "Learn more" link if applicable

4. Network error empty state
   Create new ErrorState component (similar to EmptyState):
   Uses NoNetworkIllustration
   "Couldn't load this page"
   "Check your connection and try again"
   "Retry" button (re-fetches the page data)
   
   Wire into ErrorBoundary components across the app.

═══════════════════════════════════════════════════════════════════════════
TASK 3 — VENDOR DETAIL PAGE POLISH (3h)
═══════════════════════════════════════════════════════════════════════════

Current vendor detail page is functional. Needs the same treatment
profile detail got — hero, sections, premium feel.

1. Vendor hero section
   ┌──────────────────────────────────────────────────────────┐
   │  [vendor logo/initial]                                    │
   │  Royal Decor                                              │
   │  Wedding Decoration · Bhopal · 4.8 ★ (47 reviews)        │
   │  [✓ Verified] [⭐ Top Rated] [💰 Affordable]             │
   │                                                            │
   │  [Get Quote] [Save] [Share]                              │
   └──────────────────────────────────────────────────────────┘
   
   - Vendor name in Playfair 32px Burgundy
   - Category · City · Rating · Review count
   - Trust badges as Gold pills (verified, top-rated, etc.)
   - Primary CTA: "Get Quote" Teal
   - Secondary: Save (bookmark icon), Share

2. Portfolio gallery
   - Large primary image (hero placement)
   - Below: horizontal scroll of thumbnails on mobile, 3-col grid on desktop
   - Tap thumbnail → lightbox (reuse profile lightbox component)
   - Photo counter overlay on primary "23 photos"
   - If no portfolio: show "Portfolio coming soon" with NoVendorsIllustration

3. Packages section
   - SectionHeader "Packages"
   - Cards in grid (2-col tablet, 3-col desktop, stack mobile)
   - Each package card:
     - Package name (Playfair 18px)
     - Price (Playfair 24px Burgundy, ₹ symbol)
     - "Starting from" muted text above price
     - Bullet list of inclusions (3-5 items, lucide check icons in Gold)
     - "Book Now" Teal CTA at bottom
   - Most popular package: Gold/20 left border + "Most Popular" Gold ribbon

4. Reviews section
   - SectionHeader "Reviews" + overall rating display
   - Rating distribution: 5★ ████░ 32, 4★ ███░░ 12, etc.
   - Recent reviews (top 3, "View all" link)
   - Each review card:
     - Reviewer initial avatar (Gold/20 bg)
     - Name + city
     - 5-star rating (filled stars in Gold)
     - Review text (italic Playfair if quote-worthy, regular otherwise)
     - Date (muted)
   - If no reviews: "Be the first to review" CTA

5. Availability calendar
   - Compact month view
   - Days vendor is booked: muted gray
   - Days available: white with Gold/20 border on hover
   - Click date → opens booking modal with selected date pre-filled
   - "View next month →" link
   - If vendor doesn't expose calendar: show "Contact vendor for availability"

6. Vendor info bottom strip
   - About vendor (Playfair italic, 2-3 sentences)
   - Service areas (chip list of cities)
   - Years in business
   - Languages spoken
   - Contact: phone/email shown only after match/booking confirmed

═══════════════════════════════════════════════════════════════════════════
VERIFICATION
═══════════════════════════════════════════════════════════════════════════

After all 3 tasks:
pnpm --filter @smartshaadi/web type-check → zero errors
pnpm --filter @smartshaadi/web build → succeeds

Visual QA:
□ All 10 illustrations feel like the same illustrator's family
□ Every list/grid in app has an appropriate empty state
□ ErrorBoundary uses ErrorState for failed fetches
□ Vendor detail hero feels premium with trust badges
□ Vendor portfolio gallery + lightbox works
□ Packages render with "Most Popular" ribbon variant
□ Reviews section with distribution + recent
□ Availability calendar interactive

Commits:
Commit 1: "polish(ui): illustration family consistency + 4 new illustrations"
Commit 2: "feat(ui): comprehensive empty state coverage + ErrorState for network failures"
Commit 3: "polish(vendor): premium vendor detail page with hero, packages, reviews, calendar"

git push origin main