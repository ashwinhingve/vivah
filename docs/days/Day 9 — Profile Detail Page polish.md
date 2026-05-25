Read first:
- apps/web/src/app/(app)/profiles/[profileId]/page.tsx
- apps/web/src/app/(app)/profiles/[profileId]/PhotoGallery.client.tsx (or equivalent)
- apps/web/src/app/(app)/profiles/[profileId]/ProfileActions.client.tsx
- apps/web/src/components/profile/ (all profile components)
- apps/web/src/components/ui/CompatibilityScore.tsx
- apps/web/src/components/ui/ProfileCard.tsx (initialed avatar pattern from Day 8)
- packages/types/src/profile.ts (full profile shape)

Day 9 — Profile detail page deep polish.
This is the page users view most after match feed. Currently functional,
needs the same treatment landing + dashboard got.
NO plan approval. Plan 5 lines per task. Sequential commits.

═══════════════════════════════════════════════════════════════════════════
TASK 1 — IDENTITY HERO REFINEMENT (2h)
═══════════════════════════════════════════════════════════════════════════

Current identity hero (right column top): Name, age, profession, city,
verification strip. Functional but flat.

Refactor to a layered hero with visual hierarchy:

1. Primary identity row
   ┌─────────────────────────────────────────────────────────┐
   │  Riya Sharma, 26                              [Online]  │
   │  Software Engineer · Bhopal                              │
   └─────────────────────────────────────────────────────────┘
   - Name + age: Playfair 32px Burgundy (use serif font-display)
   - Profession + city: Inter 16px Charcoal/80, dot separator
   - Online dot: green if active in last 5min, gray "Active 2h ago" if not
   - Online pill: top-right of the row, small Teal pill

2. Activity strip — below identity row
   Two pieces of microcopy in a single muted row:
   "Joined 3 months ago · Last active 2h ago · Profile viewed 47 times"
   Inter 13px, muted color.
   The "Profile viewed N times" only shows if viewing your own profile,
   otherwise show "Member since {month, year}".

3. Verification trust strip — refined version
   Currently 4 icons + labels in a row. Issue: feels checkbox-y, not premium.
   
   Refactor to compact pill row:
   [✓ Phone] [✓ Aadhaar KYC] [✓ Photo Verified] [✓ Govt ID]
   - Each pill: Gold/20 background, Teal text, BadgeCheck icon (12px)
   - Pills are inline-flex with gap-2, wrap on mobile
   - Unverified items don't show as gray pills — just omit them
     (showing unverified items reduces trust)
   - If user has ALL 4 verifications: add a single "Fully Verified" 
     trophy chip in Burgundy with a Gold star icon

4. CTA proximity
   Move the primary action buttons (Shortlist / Connect / More) directly
   below the verification strip on desktop, not at page bottom.
   Reasoning: users decide to connect within 5 seconds of viewing.
   Burying CTAs below tabs forces unnecessary scroll.
   Mobile: keep sticky bottom (existing pattern).

═══════════════════════════════════════════════════════════════════════════
TASK 2 — COMPATIBILITY SECTION ELEVATION (3h)
═══════════════════════════════════════════════════════════════════════════

Currently a card with gauge + Guna score + reasons. Needs to feel like
the most important section on the page — because it is.

1. Section header
   Replace the existing SectionHeader with a more prominent treatment:
   "How compatible are you?"
   Subtext: "Based on 8 Ashtakoot factors, lifestyle, and preferences"
   Center-aligned, Playfair 24px Burgundy
   Below: thin Gold horizontal divider (60% width centered)

2. Compatibility composition — 2-column on desktop, stack on mobile
   Left column (60%):
     CompatibilityScore gauge variant — 160px size (larger than current)
     Below gauge: "92% Match" label in Playfair 20px
     Below label: tier description in Inter muted
       (Excellent / Strong / Good / Fair / Limited per existing color band)
   
   Right column (40%):
     Guna Milan breakdown
     Top: "Guna Milan" Playfair 18px + score chip "30/36" Burgundy pill
     Below: 8 Ashtakoot factors as compact rows, not pills:
       Varna       ████░░ 4/5  
       Vashya      █████░ 5/5  
       Tara        ████░░ 4/5  
       Yoni        ████░░ 4/5  
       Graha Maitri ████░ 5/5  
       Gana        ██░░░░ 2/4  
       Bhakoot     ██████ 6/7  
       Nadi        ░░░░░░ 0/8  ⚠
     Bar fill: Teal for >=80%, Gold for 60-79%, Burgundy for <60%
     Nadi at 0/8 gets a small warning icon (this is the famous "deal-breaker")
     If user/candidate doesn't have horoscope data, show:
       "Add horoscope to see Guna score →" with link to /profile/horoscope

3. Why this match — refined
   Section below the composition row
   "Why we matched you"
   Subtext: 3 reasons from API explainer rendered as numbered list
   Each reason gets a Gold numbered circle (1, 2, 3) and Playfair italic text
   
   Example:
   ① Both in Bhopal, 4km apart
   ② Same diet (vegetarian) and family values
   ③ Strong preference overlap on education and profession

4. Caveat (if any)
   If API returns a caveat, render as muted line below reasons:
   "Note: {caveat}" with small info icon, Gold/60 color
   Don't bury it but don't shout it.

═══════════════════════════════════════════════════════════════════════════
TASK 3 — PHOTO GALLERY POLISH (2h)
═══════════════════════════════════════════════════════════════════════════

Current PhotoGallery is functional. Needs more premium feel.

1. Primary photo treatment
   - 4:5 aspect ratio (existing)
   - Subtle inner border: 1px Gold/30 inset
   - Outer shadow: lifted, larger (shadow-xl, not shadow-md)
   - Rounded-3xl (more rounded, more premium feel)
   - On hover (desktop): scale-[1.01] over 200ms — subtle "alive" feel

2. Thumbnail row
   - 5 thumbnails below primary, 1:1 aspect each
   - Active thumbnail: 2px Teal border + scale-105
   - Inactive: opacity-70, hover opacity-100
   - If profile has fewer than 5 photos, fill remaining slots with
     subtle dashed-border placeholders (don't render empty)

3. Photos hidden state (Safety Mode)
   Currently: photo placeholder with lock icon.
   Refactor to feel premium:
   - Replace with the initialed avatar pattern (from Day 8 work)
   - Add a subtle blur effect ON TOP of the initialed avatar (backdrop-blur-md)
   - Center overlay card with:
     Lock icon (24px, Gold)
     "Photos protected by Safety Mode"
     "Unlock by mutually accepting the connection"
     Small "Send Interest →" CTA (Teal text link)
   This converts the "hidden photos" moment from "broken" to "premium privacy feature"

4. Lightbox modal
   When user taps/clicks primary photo, open fullscreen lightbox:
   - Black backdrop at 90% opacity
   - Photo centered, max 80vh
   - Left/right arrows (desktop), swipe (mobile)
   - Bottom: photo counter "2 / 6"
   - Top-right: close X button (44px touch target)
   - Esc key closes (desktop)
   Use framer-motion AnimatePresence for enter/exit

═══════════════════════════════════════════════════════════════════════════
TASK 4 — TAB CONTENT REFINEMENT (3h)
═══════════════════════════════════════════════════════════════════════════

Current tabs: About / Family / Career / Lifestyle / Horoscope / Preferences
Tab content cards exist but feel generic. Refine each.

1. Tab nav refinement
   - Active tab: Teal bottom border (3px) + Teal text + Inter semibold
   - Inactive: muted text, no border
   - Helper text below each tab label (existing pattern, keep)
   - Horizontal scroll on mobile (existing)
   - Add subtle Gold/20 background to active tab on hover state

2. About tab
   Current: bio paragraph + personal info grid
   Refactor bio rendering:
   - If bio is multi-paragraph: wrap in Playfair italic, 16px line-height-relaxed
   - If bio is short (<100 chars): center-align it in Playfair italic 18px
     with subtle decorative quote marks (Gold) flanking it
   - If no bio: show muted "Bio not added yet" — not empty space
   
   Personal info grid:
   - 2-column on desktop (current), 1-column mobile
   - Each row: label (Inter 12px muted uppercase) + value (Inter 15px Charcoal)
   - DOB shown as "26 March 1998 (26 years)" — not raw date
   - Height shown as "5'7\" / 170 cm" — both units
   - Religion shown with caste/gotra inline if filled, omit if not

3. Family tab
   Current: family info paragraphs. Refactor to visual hierarchy.
   
   Sections within Family tab:
   a) Family setup card (compact summary)
      "Joint Family · Traditional Values · Located in Bhopal"
      Single line, Playfair 16px, summarizes 3 attributes
   
   b) Parents section
      "Father: {name}, {occupation}"
      "Mother: {name}, {occupation}"
      Each with small avatar circle (initialed pattern, smaller)
   
   c) Siblings section
      If has siblings: list each with relationship + status
      "Elder brother · Married"
      "Younger sister · Single"
   
   d) Family values pills
      [Traditional] [Spiritual] [Education-focused] [Community-active]
      Render whatever family values are set in profile

4. Career tab
   Current: occupation + education paragraphs.
   Refactor to timeline-feel layout:
   
   Career row:
   "Senior Software Engineer at Tech Corp"
   "₹12-18 LPA · Bhopal · 4 years experience"
   
   Education timeline (vertical):
   ● B.Tech Computer Science · IIT Bhopal · 2020
   ○ 12th Class · Kendriya Vidyalaya · 2016
   Each entry: bullet + degree/college/year
   Most recent first, others muted

5. Lifestyle tab
   Refactor diet/smoking/drinking into chip row:
   [🥗 Vegetarian] [🚭 Non-smoker] [🍷 Occasionally]
   Hobbies as chip grid below
   Hyper-niche tags as Gold-tinted chip variants

6. Horoscope tab
   Current: shows rashi/nakshatra if filled.
   If filled: render as a card with traditional astrological emphasis:
   - Playfair heading "Vedic Profile"
   - Two columns: Rashi (with symbol icon) | Nakshatra (with name)
   - Manglik status as a pill: Manglik (Burgundy) / Non-Manglik (Teal) / Anshik Manglik (Gold)
   - DOB/TOB/POB in a muted footer row
   
   If empty: show Add Horoscope CTA card
   "Add your horoscope to unlock Guna Milan compatibility"
   [Add Horoscope →] Teal button

7. Preferences tab
   Current: shows partner preferences.
   Refactor: organized by category with subtle dividers
   - Age range, Education, Income → "Partner basics"
   - Religion, Caste, Diet → "Cultural preferences"  
   - Location, Distance → "Geography"
   - Must-haves as Gold-bordered chips (already exists)
   - Open to: flags as Teal pills only when true

═══════════════════════════════════════════════════════════════════════════
VERIFICATION
═══════════════════════════════════════════════════════════════════════════

After all 4 tasks:
pnpm --filter @smartshaadi/web type-check → zero errors
pnpm --filter @smartshaadi/web build → succeeds

Visual QA:
□ Identity hero has clear hierarchy, CTAs above the fold on desktop
□ Compatibility section feels like the most important on page
□ Guna Milan bars render with correct color bands
□ Photo gallery hover/active states work
□ Hidden photos state feels premium not broken
□ Lightbox opens fullscreen with arrows + counter
□ Each tab content has visual variety, not just paragraphs

Commits:
Commit 1: "polish(profile): identity hero refinement with verification pills + CTA proximity"
Commit 2: "feat(profile): compatibility section with Ashtakoot bars and numbered match reasons"
Commit 3: "polish(profile): premium photo gallery with lightbox and Safety Mode treatment"
Commit 4: "polish(profile): refined tab content with hierarchy across all 6 tabs"

git push origin main