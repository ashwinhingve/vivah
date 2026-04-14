# Smart Shaadi: Build UI Component — $ARGUMENTS
# Usage: /ui-component [component name + context]
# Example: /ui-component profile match card with compatibility score, accept/decline buttons

---

## The Design-First Rule

Never jump straight to writing JSX. Follow this sequence every time.
A component built without a design plan looks like AI slop. A component built with one looks like a senior designer built it.

---

## Step 1 — Design Intent (Say This First)

Before generating any code, state:
- **What** this component IS (e.g., "a match recommendation card")
- **Where** it appears (e.g., "the main matchmaking feed, shown 10 at a time")
- **Who** uses it (e.g., "both the user AND their parents — design for both")
- **What the user DOES** with it (e.g., "taps to view full profile, swipes or taps accept/decline")
- **What data** it shows (e.g., "name, age, city, compatibility score, primary photo")
- **Emotional tone** (refer to the Brand Personality section below)

---

## Step 2 — Brand Personality

Smart Shaadi is NOT a dating app. It is a family-trusted matrimonial platform.

### The Feeling We Design For

| We ARE                     | We are NOT                  |
|----------------------------|-----------------------------|
| Warm, like a family room   | Cold, like a corporate SaaS |
| Auspicious, like a mandap  | Flashy, like a nightclub    |
| Trustworthy, like a family elder | Transactional, like a marketplace |
| Premium, like bridal silk  | Cheap, like a coupon site   |
| Modern, like a curated boutique | Outdated, like a government form |

### The 30-Second Test

Show any screen to a 55-year-old Indian parent. If they feel comfortable using it without help, the design is correct. If they feel it looks like "one of those dating apps," redesign it.

---

## Step 3 — Design System: Royal Burgundy · Warm Gold · Peacock Teal

### Color Palette

```
LIGHT MODE (default — always ship light mode first)

  Primary (Burgundy):   #7B2D42  — headings, nav, brand identity
  Primary Hover:        #5C2032  — hover/pressed state for primary elements
  Gold Accent:          #C5A47E  — trust signals, verified badges, premium indicators, decorative
  Gold Muted:           #9E7F5A  — secondary gold for borders, subtle accents
  Teal CTA:             #0E7C7B  — ALL primary action buttons (Send Interest, Connect, Book)
  Teal Hover:           #149998  — hover state for CTA buttons
  Background:           #FEFAF6  — page background (warm ivory, not sterile white)
  Surface:              #FFFFFF  — card backgrounds, modals, sheets
  Text Primary:         #2E2E38  — body text, labels
  Text Muted:           #6B6B76  — secondary text, timestamps, helper text
  Border:               #E8E0D8  — card borders, dividers (warm, not cold gray)
  Border Light:         #F0EBE4  — subtle separators, table rows
  Success:              #059669  — Guna match scores, verified checkmarks
  Warning:              #D97706  — alerts, incomplete profile nudges
  Error:                #DC2626  — validation errors, blocks
  Info:                 #0E7C7B  — informational badges (use bg-[#0E7C7B]/10 with teal text, NOT solid teal — solid teal is reserved for CTA buttons only)

DARK MODE (opt-in toggle, never default)

  Background:           #1A1A24  — page background
  Surface:              #2D2D3A  — card backgrounds
  Surface Elevated:     #363645  — modals, dropdowns
  Text Primary:         #F0EBE4  — body text
  Text Muted:           #9090A0  — secondary text
  Border:               #404050  — dividers
  Primary (Burgundy):   #A04460  — lightened for dark bg readability
  Gold Accent:          #D4B896  — lightened gold
  Teal CTA:             #10A3A0  — brightened teal (MUST pop on dark surfaces)
  Teal Hover:           #12B8B5  — hover state
```

### Color Assignment Rules (One Color, One Job)

| Color    | Job                              | NEVER use it for          |
|----------|----------------------------------|---------------------------|
| Burgundy | Brand, headings, nav bar         | Action buttons            |
| Gold     | Trust badges, premium, decorative borders | CTA buttons, body text, headings |
| Teal     | Primary actions, interactive CTA | Decoration, headings      |
| Green    | Success states, match scores     | Buttons, links            |
| Amber    | Warnings, nudges                 | Positive signals          |

If you catch yourself using burgundy for a button or gold for a CTA, stop. You're breaking hierarchy.

---

### Typography

```
Heading Font:    "Playfair Display", Georgia, "Noto Serif Devanagari", serif
Body Font:       system-ui, -apple-system, "Segoe UI", sans-serif
Mono Font:       "JetBrains Mono", ui-monospace, monospace (admin/dev screens only)

Usage:
  h1:  Playfair Display, 28px/32px, font-semibold, text-[#7B2D42], tracking-tight
       (page titles ONLY — "Recommended Matches", "My Profile", "Wedding Dashboard")
  h2:  Playfair Display, 22px/28px, font-semibold, text-[#2E2E38], tracking-tight
       (section headings — "Family Details", "Photo Gallery")
  h3:  Playfair Display, 18px/24px, font-medium, text-[#2E2E38]
       (subsection headings — "Guna Milan Score", "Education")
  h4:  System sans, 16px/22px, font-semibold, text-[#2E2E38]
       (card titles, list headings — never use Playfair below this level)
  body: System sans, 14px/22px (text-sm), font-normal, text-[#2E2E38]
  small: System sans, 12px/18px (text-xs), font-normal, text-[#6B6B76]
  label: System sans, 12px/16px (text-xs), font-medium, uppercase, tracking-wide, text-[#6B6B76]
  overline: System sans, 10px/14px, font-semibold, uppercase, tracking-widest, text-[#9E7F5A]
       (category labels above sections — "RECOMMENDED", "FEATURED VENDORS")
       ⚠ Gold tones fail WCAG on light bg. Overlines are decorative, so add aria-hidden="true"
       and ensure the real heading below conveys the same context.

Hindi/Regional Text:
  Use "Noto Serif Devanagari" for Hindi headings (Kundli sections, Guna Milan, puja details)
  Use "Noto Sans Devanagari" for Hindi body text
  Always load regional fonts via @font-face with font-display: swap

Google Fonts import (only these two, nothing else):
  Playfair Display: weights 500, 600, 700
  Noto Serif Devanagari: weights 400, 600 (load only when Hindi content is present)
```

### Why This Pairing Works

Playfair Display is a transitional serif — it carries the gravitas of a wedding invitation without feeling stuffy. System sans-serif for body keeps load times fast and feels native on every phone. The contrast between serif headings and sans-serif body creates a "premium editorial" feel that separates Smart Shaadi from every competitor using generic sans-serif everywhere.

---

### Spacing

```
Base unit:       4px (Tailwind default)
Cards:           p-4 (mobile), p-5 (desktop)
Card gaps:       gap-3 (tight lists like chat), gap-4 (feed cards)
Sections:        gap-6 (between major page sections)
Page padding:    px-4 (mobile), px-6 (tablet+)
Page max-width:  max-w-screen-lg mx-auto
Form fields:     space-y-4
Inline groups:   gap-2 (tags, badges, pill groups)
```

### Radius

```
Cards:           rounded-xl (12px)
Photos:          rounded-2xl (16px) — profile photos get extra roundness
Badges/Pills:    rounded-full
Buttons:         rounded-lg (8px)
Inputs:          rounded-lg (8px)
Modals:          rounded-2xl (16px)
Bottom sheets:   rounded-t-2xl (mobile)
Avatars:         rounded-full
```

### Shadows

```
Cards (rest):    shadow-sm — subtle, never heavy
Cards (hover):   shadow-md — gentle lift on hover/focus
Modals:          shadow-xl — clear elevation
Bottom sheets:   shadow-2xl — top shadow for mobile sheets
Floating actions: shadow-lg — FABs, floating buttons

NEVER use: shadow-2xl on cards, colored shadows, or neon glow effects.
Shadows should feel like natural light, not like Dribbble mockups.
```

### Borders

```
Cards:           border border-[#E8E0D8] — warm, not cold gray
Inputs:          border border-[#E8E0D8] focus:border-[#0E7C7B] focus:ring-2 focus:ring-[#0E7C7B]/20
Dividers:        border-t border-[#F0EBE4] — subtle, nearly invisible
Profile photos:  border-2 border-[#C5A47E] — gold frame (trust signal)
Verified photos: border-2 border-[#059669] — green frame (verified signal)
```

---

## Step 4 — Photo Treatment

Photos are the most-viewed element on any matrimonial platform. Bad photo treatment = bad first impression of the entire product.

### Profile Photo Rules

```
Primary Photo (Card):
  - Size: 100% width, aspect-ratio 4/3 (object-cover), min-height 180px, max-height 260px
  - Radius: rounded-2xl (top corners if inside a card: rounded-t-2xl)
  - Border: 2px solid #C5A47E (gold frame = premium feel)
  - Fallback: Warm gradient (#7B2D42 → #C5A47E) with initials in Playfair Display
  - Never: Stretch, distort, or crop faces below the eyes

Avatar (Small — Chat, Lists):
  - Size: 40×40px (minimum), 48×48px (preferred)
  - Radius: rounded-full
  - Border: 2px solid #C5A47E
  - Fallback: Burgundy circle (#7B2D42) with white initials

Photo Gallery (Profile View):
  - Grid: 3 columns on desktop, 2 columns on mobile
  - Aspect ratio: aspect-square (1:1) with object-cover
  - Radius: rounded-xl
  - Gap: gap-2
  - Tap to view: full-screen lightbox with swipe navigation
  - Max visible: Show 6, then "View All (X photos)" link

Photo Overlay (Match Card):
  - Bottom gradient: linear-gradient(transparent, rgba(0,0,0,0.6))
  - Name + Age + City in white over the gradient
  - Font: Playfair Display for name, system sans for age/city
  - Verified badge positioned top-right corner of photo

Blurred Photo (Privacy Mode):
  - Apply CSS: filter: blur(20px) saturate(0.5) — static, set once, not animated
  - Mobile unlock: opacity 0→1 fade-in over 0.3s (NOT blur transition — too GPU heavy on mid-range Android)
  - Desktop unlock: blur(20px)→blur(0) over 0.4s ease-out (desktop GPUs handle this fine)
  - Overlay text: "Photo visible after mutual interest"
```

### Photo Don'ts

- Never show photo without a border/frame — photos floating on white look cheap
- Never use square corners for profile photos — too clinical
- Never auto-crop without face detection — half-face crops destroy trust
- Never show empty gray boxes — always use a warm-toned fallback with initials

---

## Step 5 — Family Trust UI Patterns

These patterns cost almost nothing to build but directly address the #1 user anxiety: "Is this platform safe for my family?"

### Pattern 1: Profile Creator Badge

Shows WHO created the profile. Normalizes family involvement — don't hide it.

```
Variants:
  "Self"        → icon: User       → style: bg-[#6B6B76]/10 text-[#6B6B76]   (neutral, low-key)
  "Parent"      → icon: Users      → style: bg-[#7B2D42]/10 text-[#7B2D42]   (burgundy, warm — most common)
  "Sibling"     → icon: Users      → style: bg-[#7B2D42]/10 text-[#7B2D42]
  "Relative"    → icon: Users      → style: bg-[#7B2D42]/10 text-[#7B2D42]
  "Friend"      → icon: UserPlus   → style: bg-[#6B6B76]/10 text-[#6B6B76]

Display: Small pill below the profile name
  "Profile by Parent" | "Profile by Self"
Base design: rounded-full text-xs font-medium px-3 py-1
  (apply variant-specific bg + text color from above)
```

### Pattern 2: Verification Trust Ladder

A tiered badge system. More verification = more visibility in matching.

```
Level 0 — Unverified:
  No badge. Subtle prompt: "Verify to get 3× more responses"

Level 1 — Phone Verified:
  Icon: Phone checkmark
  Badge: text-[#6B6B76] (muted — this is minimum, not special)

Level 2 — ID Verified:
  Icon: Shield with check
  Badge: text-[#0E7C7B] bg-[#0E7C7B]/10
  Label: "ID Verified"

Level 3 — Family Verified:
  Icon: Shield with star
  Badge: text-[#9E7F5A] bg-[#C5A47E]/15 border border-[#C5A47E]/30
  Label: "Family Verified" — means a family member has endorsed the profile
  This is the GOLD badge. Visually distinct. Uses goldMuted for text (NOT #C5A47E — fails contrast on light bg).

Level 4 — Background Checked (Premium):
  Icon: Shield with double check
  Badge: text-[#059669] bg-[#059669]/10
  Label: "Background Verified ✓"
```

### Pattern 3: Privacy Shield Indicator

Shows what information is visible vs. masked at each stage of connection.

```
Before Interest:
  - Full name visible
  - Photo visible (or blurred if user chose privacy mode)
  - Age, city, profession visible
  - Phone: MASKED → "Visible after mutual interest"
  - Email: MASKED
  - Exact address: MASKED
  - Family details: Summary only

After Mutual Interest:
  - Phone visible
  - Email visible
  - Full family details visible
  - Chat unlocked

After Decline (either side):
  - Profile removed from feed (don't show declined profiles again)
  - No notification sent to the other party (silent decline — reduces anxiety)
  - Undo option: "You declined this profile" toast with "Undo" button, auto-dismiss after 5s
  - After undo window closes, profile is permanently filtered out

UI Treatment:
  Masked fields show: "🔒 Visible after mutual interest"
  Style: text-[#6B6B76] text-xs italic with a Lock icon
  On reveal: animate with a subtle fade-in + unlock icon animation
```

### Pattern 4: Safety Mode Toggle

A global toggle in profile settings. When ON:

```
- All photos require mutual interest to view (blurred by default)
- Contact info never shown until both parties accept
- Chat messages are monitored for abusive language (show a subtle "Protected" badge in chat)
- Screenshot notification (optional — let user choose)
- Quick block/report with zero friction (one tap, not a buried menu)

UI: Toggle switch with burgundy active state
  Label: "Safety Mode"
  Description: "Extra privacy controls for your profile"
  Position: Top of Privacy settings, not buried
```

### Pattern 5: Kundli / Guna Milan Trust Display

For users who care about astrological compatibility (a huge segment).

```
Guna Score Display:
  - Show as a circular progress: X/36 Gunas matched
  - Color coding:
    0–17:   text-[#DC2626] (red) — "Low Compatibility"
    18–24:  text-[#D97706] (amber) — "Moderate Compatibility"
    25–32:  text-[#0E7C7B] (teal) — "Good Compatibility"
    33–36:  text-[#059669] (green) — "Excellent Compatibility"
  - Below the score: expandable breakdown of all 8 Kootas
  - Font for "Guna Milan": Noto Serif Devanagari (this is a cultural element — honor it)
  - Option to hide for users who don't want Kundli matching
```

---

## Step 6 — Component States (Every Component Must Have These)

No component is "done" without all five states.

### Loading State
```
Use skeleton screens, NOT spinners.
  - Photo placeholder: rounded-2xl bg-[#E8E0D8] animate-pulse
  - Text placeholder: rounded bg-[#E8E0D8] animate-pulse h-4 w-3/4
  - Card placeholder: rounded-xl border border-[#E8E0D8] p-4 with skeleton children
  - Show skeleton if data takes > 200ms
  - Never show a blank white screen. Ever.
```

### Empty State
```
Every list can be empty. Design for it.
  - Illustration: Simple, warm-toned line art (not cold blue illustrations)
  - Headline: Playfair Display, encouraging tone
  - Subtext: system sans, text-[#6B6B76], with a clear action
  - Examples:
    No matches yet: "Your perfect match is out there" + "Complete your profile to get better matches"
    No messages: "Start a conversation" + "Send interest to someone you like"
    No vendors: "No vendors in this category yet" + "Check back soon or try a different city"
```

### Error State
```
  - Inline errors: text-[#DC2626] text-xs below the field, with a subtle red border
  - Page errors: Warm illustration + "Something went wrong" + Retry button
  - Network errors: Toast/banner at top, auto-retry with countdown
  - Never show raw error codes or stack traces
  - Tone: "We couldn't load your matches right now. Trying again..." (not "Error 500")
```

### Success State
```
  - Inline: Green check + brief confirmation text, auto-dismiss after 3s
  - Modal: For big moments (match accepted, booking confirmed) — use confetti/celebration sparingly
  - Toast: For minor actions (saved, copied, updated)
  - Color: #059669 green, never teal (teal is for actions, green is for results)
```

### Disabled State
```
  - Opacity: opacity-50 cursor-not-allowed
  - No hover effect, no pointer cursor
  - If a button is disabled, show WHY via a tooltip or helper text below
  - Example: "Complete your profile to send interest" below a disabled button
```

---

## Step 7 — Mobile-First Rules

Everything ships mobile-first. Desktop is the enhancement, not the other way around.

```
Breakpoints:
  Default:   375px (mobile — design HERE first)
  sm:        640px (large phones, small tablets)
  md:        768px (tablets)
  lg:        1024px (desktop)
  xl:        1280px (wide desktop)

Touch Targets:
  Minimum: 44×44px for ALL interactive elements
  Preferred: 48×48px for primary actions
  Spacing between targets: minimum 8px gap (so fat thumbs don't mis-tap)

Navigation:
  Mobile: Bottom tab bar (5 items max: Home, Matches, Chat, Events, Profile)
  Desktop: Top nav bar with the same items
  Never: Hamburger menu for primary navigation. Side drawers for secondary only.

Scrolling:
  Vertical scroll ONLY for main content
  Horizontal scroll ONLY for photo galleries and category pills
  No horizontal scroll on any page layout — if it scrolls horizontally on 375px, it's broken

Bottom Sheet:
  Use for filters, options, confirmations on mobile
  rounded-t-2xl, max-height 85vh, draggable handle at top
  Always include a clear close/cancel button (don't rely on drag-to-dismiss alone)

Keyboard:
  When input is focused, scroll the field into view
  Show appropriate keyboard type: tel for phone, email for email, numeric for OTP
  Auto-focus first field on form pages
```

---

## Step 8 — Motion & Micro-Interactions

Movement should feel like silk, not like a PowerPoint transition.

```
Timing Function:
  Default: ease-out (fast start, gentle stop — feels responsive)
  Spring-like: cubic-bezier(0.34, 1.56, 0.64, 1) (for playful elements like match animation)

Durations:
  Instant feedback (button press, toggle): 100–150ms
  Small transitions (dropdown, tooltip): 200ms
  Page transitions: 300ms
  Celebrations (match accepted): 600–800ms
  NEVER exceed 1 second for any animation. If it feels slow, it IS slow.

What Gets Motion:
  ✓ Card entering the feed (fade-up, staggered by 50ms per card)
  ✓ Match accepted celebration (heart pulse + confetti)
  ✓ Photo blur → reveal (smooth blur transition)
  ✓ Button hover/press (subtle scale: scale-[0.98] on press)
  ✓ Bottom sheet sliding up
  ✓ Page route transitions (fade + slight upward shift)
  ✓ Skeleton → real content (fade-in)

  ✗ No bouncing logos
  ✗ No parallax scrolling
  ✗ No auto-playing carousels
  ✗ No elements that move without user action
  ✗ No motion that blocks the user from doing what they came to do

Reduced Motion:
  ALWAYS wrap animations in @media (prefers-reduced-motion: no-preference)
  Respect the user's OS setting. Animations become instant transitions.
```

### Animation Code Patterns (Copy-Paste Ready)

**Card fade-in (Framer Motion):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
```

**Staggered list (Framer Motion):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, delay: index * 0.05 }}
>
```

**Button press (Tailwind only — no JS library needed):**
```html
<button class="transition-transform duration-100 active:scale-[0.97]">
```

**Skeleton pulse (Tailwind only):**
```html
<div class="animate-pulse bg-border rounded h-4 w-3/4" />
```

**Bottom sheet slide-up (CSS):**
```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.bottom-sheet { animation: slideUp 250ms ease-out; }
```

**Reduced motion wrapper (CSS — add to globals.css):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Performance Constraints

```
Target devices: mid-range Android (Redmi, Realme, Samsung A-series)
  - Max 400ms for any animation (sluggish on budget Snapdragon chips)
  - No blur() transitions on mobile (GPU-intensive, causes frame drops)
    → Use opacity transitions as the mobile alternative to blur effects
  - No box-shadow transitions (repaint-heavy) — use transform/opacity only
  - Limit simultaneous animations to 3 elements max on screen
  - Test on Chrome DevTools with CPU throttling 4× slowdown
```

---

## Step 9 — Accessibility (Non-Negotiable)

```
Color Contrast:
  Text on #FEFAF6 bg: use #2E2E38 (passes WCAG AA at 10.5:1) ✓
  Muted text on #FEFAF6: use #6B6B76 (4.8:1 — passes AA for normal text, but keep ≥13px for comfort)
  Teal CTA: #FFFFFF on #0E7C7B (4.6:1 — passes AA but TIGHT. Always use font-semibold/bold on teal buttons)
  Teal text on white: #0E7C7B on #FFFFFF (4.6:1 — passes AA, but only for ≥14px text)
  Burgundy on ivory: #7B2D42 on #FEFAF6 (7.2:1 — excellent) ✓
  Gold text on light bg: #C5A47E on #FEFAF6 = 2.1:1 — FAILS. NEVER use gold as text color on light bg.
    → Gold is for borders, badges (with dark text inside), and decorative elements ONLY
  Gold text on dark bg: #C5A47E on #2D2D3A = 4.7:1 — passes AA (gold text is OK in dark mode only)

Focus States:
  All interactive elements: focus-visible:ring-2 focus-visible:ring-[#0E7C7B] focus-visible:ring-offset-2
  Never remove default focus outlines without replacing them
  Tab order must follow visual order

Screen Readers:
  All images: meaningful alt text (not "photo" — use "Priya's profile photo")
  All icons: aria-label or sr-only text
  All badges: aria-label describing what they mean ("Family verified profile")
  Dynamic content: use aria-live="polite" for toasts, match notifications
  Modals: trap focus, return focus on close

Language:
  Set lang="en" on html, or lang="hi" on Hindi sections
  This helps screen readers pronounce content correctly
```

---

## Step 10 — Indian UX Patterns (Non-Negotiable)

These are not preferences — they're requirements for an Indian matrimonial platform. Getting these wrong signals "foreign app localized badly."

```
Phone Number (Primary Identifier):
  - Always +91 prefix, auto-filled and non-editable
  - 10-digit format with auto-spacing: 98765 43210
  - OTP input: 6 separate digit boxes (w-12 h-14 each), NOT one text field
  - Auto-advance cursor to next box on digit entry
  - Keyboard type: numeric (inputMode="numeric" pattern="[0-9]*")
  - "Resend OTP" timer: show countdown, enable after 30s

Currency Display:
  - Symbol: ₹ (not INR, not Rs., not RS)
  - Indian numbering system: ₹1,50,000 NOT ₹150,000
  - Short format for budgets: "₹5L" (Lakh), "₹1.2Cr" (Crore)
  - Never use Western format ($50K, $150,000)
  - Implementation: Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

Date Display:
  - Format: DD MMM YYYY → "14 Apr 2026"
  - Never: MM/DD/YYYY (American) or YYYY-MM-DD (ISO) in UI
  - Relative dates in chat: "Today", "Yesterday", "2 days ago"
  - Muhurat dates: mark with 🔆 icon and "Auspicious Date" label
  - Calendar picker: start week on Monday (Indian convention)

Names:
  - Always show FULL NAME on profile cards (first + last minimum)
  - Never show just first name — feels like a dating app
  - Name + Community on match cards: "Ananya Sharma · Rajput"
  - Allow name in Devanagari as secondary: अनन्या शर्मा (optional field)

Community / Caste Fields:
  - NEVER mandatory (legal + ethical requirement)
  - Always labelled: "Community (Optional)"
  - Input type: predictive dropdown with search, NOT free text
  - Grouped by religion → sub-community hierarchy
  - Allow "Prefer not to say" as a visible top option
  - No filtering by community in free tier (premium feature only, with ethical safeguards)

Religion & Diet:
  - Religion: dropdown, not free text. Options include "Spiritual / No Religion"
  - Diet: Vegetarian, Non-Vegetarian, Eggetarian, Vegan, Jain
    (Jain diet is distinct from vegetarian — always separate option)

Height:
  - Display in feet-inches: 5'6" (primary)
  - Store in cm internally for Kundli calculations
  - Input: two selects (feet: 4-7, inches: 0-11) not a single text field

Income:
  - Show ranges, NEVER exact numbers: "₹10-15 Lakh/year"
  - Option: "Prefer not to say"
  - Never show income on match cards — only in detailed profile view

Language:
  - Support: English + Hindi minimum at launch
  - Language toggle: visible in nav or settings, not buried
  - When Hindi is active: headings use Noto Serif Devanagari, body uses Noto Sans Devanagari
  - Direction: LTR for both English and Hindi (Hindi is LTR)
  - Urdu support (future): will need RTL layout — design components with logical properties
    (margin-inline-start not margin-left) to prepare for this
```

---

## Step 11 — Form Inputs & Controls

Forms are the majority of onboarding. Bad forms = abandoned signups.

```
Text Input:
  Height:      44px (h-11) — meets 44px touch target
  Padding:     px-3 py-2
  Font:        text-sm (14px), text-[#2E2E38]
  Placeholder: text-[#6B6B76]/60 (lighter than muted text)
  Border:      border border-[#E8E0D8] rounded-lg
  Focus:       border-[#0E7C7B] ring-2 ring-[#0E7C7B]/20 outline-none
  Error:       border-[#DC2626] ring-2 ring-[#DC2626]/20
  Disabled:    bg-[#F8F5F0] text-[#6B6B76] cursor-not-allowed

Label:
  Position:    Above input, not inside (floating labels cause accessibility issues)
  Font:        text-xs (12px) font-medium text-[#2E2E38] mb-1.5
  Required:    Append red asterisk: <span class="text-[#DC2626]">*</span>

Helper Text:
  Font:        text-xs text-[#6B6B76] mt-1
  Error text:  text-xs text-[#DC2626] mt-1

Select / Dropdown:
  Same styling as text input
  Chevron:     text-[#6B6B76], right-aligned
  Options:     rounded-lg shadow-lg border border-[#E8E0D8] bg-white
  Option hover: bg-[#FEFAF6]

Toggle Switch:
  Size:        w-11 h-6 (44×24px)
  Active:      bg-[#7B2D42] (burgundy — for settings/preferences)
  Inactive:    bg-[#E8E0D8]
  Thumb:       bg-white shadow-sm, 20×20px

Checkbox:
  Size:        w-5 h-5 (20×20px, but clickable area 44×44px via padding)
  Checked:     bg-[#0E7C7B] border-[#0E7C7B] with white checkmark
  Unchecked:   border-2 border-[#E8E0D8] bg-white

Radio:
  Same as checkbox but rounded-full
  Selected:    border-[#0E7C7B] with inner dot in #0E7C7B

OTP Input:
  Individual boxes: w-12 h-14 text-center text-xl font-semibold
  Auto-advance to next box on input
  Keyboard type: numeric
```

---

## Step 12 — Toast & Notification System

```
Toast Position:
  Mobile:    bottom-center, 16px above bottom nav
  Desktop:   top-right, 16px from edge

Toast Styling:
  Base:      rounded-xl shadow-lg p-4 flex items-center gap-3 max-w-sm
  Success:   bg-white border-l-4 border-[#059669], icon: green check
  Error:     bg-white border-l-4 border-[#DC2626], icon: red X
  Warning:   bg-white border-l-4 border-[#D97706], icon: amber triangle
  Info:      bg-white border-l-4 border-[#0E7C7B], icon: teal info

Toast Timing:
  Success:   auto-dismiss after 3s
  Error:     persist until dismissed (user might need to read it)
  Warning:   auto-dismiss after 5s
  Info:      auto-dismiss after 4s

Animation:
  Enter:     slide-up + fade-in, 250ms ease-out
  Exit:      slide-down + fade-out, 200ms ease-in

Push Notification (in-app):
  Banner at top of screen, same styling as toast
  "New Match!" / "Interest Received" / "Message from Priya"
  Tap to navigate to relevant screen
  Swipe to dismiss
```

---

## Step 13 — Icon System

```
Library:     Lucide React (lucide-react)
             — clean, consistent line icons, tree-shakeable
             — DO NOT mix with other icon libraries

Size Scale:
  xs:  16×16px (inline with small text, badges)
  sm:  20×20px (form controls, list items)
  md:  24×24px (default — nav, buttons, cards)
  lg:  32×32px (empty states, feature highlights)
  xl:  48×48px (onboarding illustrations)

Stroke Width: 1.5 (Lucide default — lighter than 2, feels premium)

Color:       Inherit from parent text color (currentColor)
             Never use a different color system for icons

Key Icons by Feature:
  Navigation:   Home, Heart, MessageCircle, Calendar, User
  Trust:        Shield, ShieldCheck, ShieldStar (custom), Lock, Unlock
  Profile:      User, Users, UserPlus, Camera, MapPin
  Actions:      Send, X, Check, ChevronRight, Filter, Search
  Wedding:      Heart, Gift, Cake, Music, Camera, Star
  Status:       CheckCircle, AlertCircle, AlertTriangle, XCircle, Info
```

---

## Step 14 — Z-Index Scale

```
Layer 0:     z-0    — page content, cards
Layer 1:     z-10   — sticky headers, floating badges
Layer 2:     z-20   — dropdown menus, popovers
Layer 3:     z-30   — bottom navigation bar
Layer 4:     z-40   — bottom sheets, side drawers
Layer 5:     z-50   — modals, dialogs
Layer 6:     z-[60] — toasts, notifications (above modals)
Layer 7:     z-[70] — tooltips (topmost)

Rules:
  Never use arbitrary z-index values like z-[999] or z-[9999]
  If you need something above a modal, it's a toast (z-[60])
  Bottom nav must always be above page content but below modals

Notification Badge (Unread Count):
  Position:    absolute -top-1 -right-1 on the parent icon/avatar
  Size:        min-w-[18px] h-[18px] (dot only: w-2.5 h-2.5 if no count)
  Style:       bg-[#DC2626] text-white text-[10px] font-bold rounded-full
               flex items-center justify-center px-1
  Count:       Show exact number 1–9, then "9+" for 10+
  Animation:   scale-in on new notification (scale 0→1, 200ms spring)
  Where used:  Bottom nav icons (Chat, Matches), chat list avatars, bell icon

Scrollbar (Desktop):
  Width:       6px (thin)
  Track:       transparent
  Thumb:       bg-[#E8E0D8] rounded-full, hover: bg-[#D3CBC2]
  CSS:
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #E8E0D8; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #D3CBC2; }
    scrollbar-width: thin; scrollbar-color: #E8E0D8 transparent;
  Mobile: hide scrollbars entirely (::-webkit-scrollbar { display: none; })
```

---

## Step 15 — Image Optimization

```
Next.js Image:
  Always use next/image for profile photos and gallery images
  Specify width + height or use fill with sizes prop
  Priority loading: only for above-the-fold hero photo in match cards

Sizes:
  Profile card photo:      width={400} height={400} (serves 200px × 2 for retina)
  Avatar (chat, lists):    width={96} height={96}  (serves 48px × 2)
  Photo gallery thumbnail: width={300} height={300}
  Full-screen lightbox:    width={1200} height={1200}
  Vendor card banner:      width={600} height={340}

Format:
  Prefer WebP with JPEG fallback (next/image handles this automatically)
  Quality: 80 (profile photos), 75 (gallery thumbnails)

Lazy Loading:
  Default: lazy (below-the-fold images)
  Priority: only first 2 match cards in feed, hero profile photo
  Placeholder: blur (use blurDataURL with a tiny base64 placeholder)

Upload Constraints (client-side validation):
  Max file size: 5MB per photo
  Accepted formats: .jpg, .jpeg, .png, .webp, .heic
  Min dimensions: 400×400px
  Max photos per profile: 8
  Show upload progress bar with teal fill
```

---

## Step 16 — Tailwind Config Integration

Wire design tokens into Tailwind so you can use `bg-primary`, `text-gold`, etc. instead of arbitrary values.

> ⚠ **Smart Shaadi uses Tailwind v4. Use the `@theme` block further below, NOT this config.**
> This v3 config is kept as reference only — for projects still on Tailwind v3.

```typescript
// tailwind.config.ts (TAILWIND v3 ONLY — not used in Smart Shaadi)
import type { Config } from "tailwindcss";
import { colors, fonts } from "./src/lib/design-tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: colors.primary, hover: colors.primaryHover, light: colors.primaryLight },
        gold:      { DEFAULT: colors.gold, muted: colors.goldMuted, light: colors.goldLight },
        teal:      { DEFAULT: colors.teal, hover: colors.tealHover, bright: colors.tealBright },
        surface:   { DEFAULT: colors.surface, dark: colors.darkSurface, elevated: colors.darkElevated },
        background:{ DEFAULT: colors.background, dark: colors.darkBg },
        border:    { DEFAULT: colors.border, light: colors.borderLight, dark: colors.borderDark },
        text:      { DEFAULT: colors.textPrimary, muted: colors.textMuted, dark: colors.textOnDark, 'muted-dark': colors.textMutedDark },
        success:   colors.success,
        warning:   colors.warning,
        error:     colors.error,
      },
      fontFamily: {
        heading: fonts.heading.split(", "),
        body:    fonts.body.split(", "),
        hindi:   fonts.hindi.split(", "),
        mono:    fonts.mono.split(", "),
      },
      borderRadius: {
        card:  "12px",  // rounded-card = rounded-xl
        photo: "16px",  // rounded-photo = rounded-2xl
      },
    },
  },
};
export default config;
```

Usage after config:
```
✓  bg-primary  text-gold  border-border  font-heading
✗  bg-[#7B2D42]  text-[#C5A47E]  border-[#E8E0D8]  font-['Playfair_Display']
```

Hardcoded hex values should only appear in design-tokens.ts, never in component code.

### Tailwind v4 CSS Token Setup (apps/web/src/app/globals.css)

If using Tailwind v4, define tokens via `@theme` instead of tailwind.config.ts:

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-primary: #7B2D42;
  --color-primary-hover: #5C2032;
  --color-primary-light: #A04460;

  /* Trust signals */
  --color-gold: #C5A47E;
  --color-gold-muted: #9E7F5A;
  --color-gold-light: #D4B896;

  /* Actions */
  --color-teal: #0E7C7B;
  --color-teal-hover: #149998;
  --color-teal-bright: #10A3A0;

  /* Backgrounds */
  --color-background: #FEFAF6;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F8F5F0;

  /* Dark mode backgrounds */
  --color-dark-bg: #1A1A24;
  --color-dark-surface: #2D2D3A;
  --color-dark-elevated: #363645;

  /* Text */
  --color-text-primary: #2E2E38;
  --color-text-muted: #6B6B76;
  --color-text-on-dark: #F0EBE4;

  /* Borders */
  --color-border: #E8E0D8;
  --color-border-light: #F0EBE4;
  --color-border-dark: #404050;

  /* Semantic */
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;

  /* Typography */
  --font-heading: "Playfair Display", Georgia, "Noto Serif Devanagari", serif;
  --font-body: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-hindi: "Noto Serif Devanagari", "Noto Sans Devanagari", serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Radius */
  --radius-card: 12px;
  --radius-photo: 16px;
}
```

Now `bg-primary`, `text-teal`, `border-border`, `font-heading` etc. all work as native Tailwind classes — no config file needed.

**Which to use:**
- Tailwind v4 (Next.js 15+): Use `@theme` in globals.css (above)
- Tailwind v3: Use tailwind.config.ts (previous block)

---

## Step 17 — Component Generation Prompt

After defining intent and confirming design system alignment, use this prompt:

```
"Using the Smart Shaadi design system (burgundy #7B2D42 / gold #C5A47E / teal #0E7C7B
on ivory #FEFAF6), generate a [component name] component.

Typography: Playfair Display for headings, system sans-serif for body.
Photo treatment: rounded-2xl with 2px gold border, warm gradient fallback with initials.
Trust patterns: Include verification badge slot, privacy shield indicators where relevant.

Use shadcn/ui primitives where available.
Use Tailwind CSS utility classes only — no inline styles.
Use theme tokens (bg-primary, text-teal, border-border) — never hardcoded hex in components.
The component must be a Server Component unless it needs:
  - onClick / onSubmit handlers
  - useState / useEffect
  - browser APIs
If client-side, name the file [ComponentName].client.tsx

Include: loading skeleton, empty state, error boundary.
Test: must render correctly at 375px with no horizontal scroll."
```

### Using 21st.dev MCP (Claude Code)

For complex interactive patterns — sliders, carousels, animated cards, charts — use:
```
/ui [describe what you need]
```
21st.dev MCP gives Claude Code access to polished Tailwind + React components.
Adapt any component to Smart Shaadi design system (burgundy/gold/teal, rounded-xl, Playfair headings).

### Using v0 MCP (Claude Code — preferred for new components)

v0 generates production-ready shadcn/ui components. Use it as the primary generator, then adapt to Smart Shaadi tokens.

```
Use v0 MCP to generate a [component name] for Smart Shaadi.
Design system: burgundy #7B2D42 / gold #C5A47E / teal #0E7C7B on ivory #FEFAF6.
Playfair Display headings. shadcn/ui primitives. Tailwind v4. Mobile-first 375px.
[specific component requirements]
After generating, save to apps/web/components/[folder]/[ComponentName].tsx
Then run the Quality Check.
```

**Workflow:** v0 generates base → Claude Code adapts to Smart Shaadi tokens → Quality Check runs.

**When to use which:**
- **v0 MCP** → full components with logic (forms, dashboards, booking flows, data tables)
- **21st.dev MCP** → individual UI primitives (animated cards, fancy sliders, micro-interactions)

---

## Core Screens Reference

| Screen              | Key Components                                                      | Priority |
|---------------------|---------------------------------------------------------------------|----------|
| Match Feed          | MatchCard, CompatibilityBadge, AcceptDeclineButtons, GunaScore      | P0       |
| Profile View        | ProfileHero, PhotoGallery, CompatibilityBreakdown, VerificationBadges, PrivacyShield | P0 |
| Chat                | MessageBubble, TranslationToggle, PhotoMessage, ReadReceipt, SafetyBadge | P0    |
| Onboarding          | StepProgress, ProfileForm, PhotoUpload, KundliInput, FamilyDetails  | P0       |
| Wedding Dashboard   | BudgetDonut, TaskKanban, CountdownTimer, VendorGrid                 | P1       |
| Guest List          | GuestRow, RSVPBadge, MealPrefTag, RoomBadge                        | P1       |
| Vendor Card         | VendorPortfolioCard, StarRating, PriceRange, BookNowButton          | P1       |
| Booking Flow        | BookingSteps, DatePicker, EscrowInfo, PaymentSummary                | P1       |
| Admin Dashboard     | StatCard, AlertBanner, VendorApprovalRow, MetricsChart              | P2       |
| Settings            | SafetyModeToggle, PrivacyControls, VerificationFlow, LanguagePicker | P1       |

---

## Component Folder Structure

Claude Code needs to know where to save generated files. Follow this convention without exception.

```
apps/web/src/components/
  matchmaking/     → MatchCard, CompatibilityBadge, GunaScore, MatchFeed, AcceptDeclineButtons
  profile/         → ProfileHero, PhotoGallery, VerificationBadge, PrivacyShield, ProfileByBadge
  chat/            → MessageBubble, TranslationToggle, ReadReceipt, SafetyBadge, PhotoMessage
  wedding/         → BudgetDonut, TaskKanban, CountdownTimer, VendorGrid, GuestRow
  vendor/          → VendorCard, StarRating, BookingFlow, PriceRange, BookNowButton
  onboarding/      → StepProgress, ProfileForm, PhotoUpload, KundliInput, FamilyDetailsForm
  shared/          → Avatar, Badge, Toast, BottomSheet, Skeleton, EmptyState, ErrorState
  forms/           → OTPInput, PhoneInput, CurrencyInput, HeightInput, CommunitySelect
  layout/          → BottomNav, TopNav, PageContainer, BottomSheetWrapper
  ui/              → shadcn/ui base components (auto-generated via CLI, never edit manually)
```

### File Naming Rules

```
Server component:     MatchCard.tsx
Client component:     MatchCard.client.tsx       (needs onClick, useState, browser APIs)
Skeleton loader:      MatchCard.skeleton.tsx      (loading state for the component)
Types:                matchcard.types.ts          (lowercase, no component prefix)
Story/test:           MatchCard.test.tsx
Index barrel:         index.ts                    (re-exports all from the folder)

Example folder:
  components/matchmaking/
    MatchCard.client.tsx
    MatchCard.skeleton.tsx
    matchcard.types.ts
    CompatibilityBadge.tsx
    GunaScore.client.tsx
    index.ts
```

---

## Quality Check (Run Before Every Component is "Done")

```
"Review this component against these checks:

 LAYOUT
 1. Does it work on 375px mobile screen without horizontal scroll?
 2. Are all touch targets at least 44×44px (including form inputs at h-11)?
 3. Is bottom navigation used on mobile (not a sidebar)?

 DESIGN SYSTEM
 4. Burgundy for page titles/brand, teal for CTAs, gold for trust signals/borders only?
 5. Playfair Display on headings (h1–h3), system sans on h4/body?
 6. Cards are rounded-xl with border-border on light mode?
 7. Profile photos have rounded-2xl with 2px gold border?
 8. No hardcoded hex values — using Tailwind theme tokens (bg-primary, text-teal, etc.)?

 TRUST PATTERNS
 9. Is verification badge displayed where profiles are shown?
 10. Is contact info masked with privacy shield before mutual interest?
 11. Does the Profile Creator badge show ("Profile by Parent/Self")?

 STATES
 12. Loading state with skeleton screens (not spinners)?
 13. Empty state with illustration + clear action?
 14. Error state with warm messaging (not error codes)?
 15. Disabled state with explanation of WHY?

 FORMS (if applicable)
 16. Labels above inputs, not floating inside?
 17. Focus state uses teal ring (ring-2 ring-teal/20)?
 18. Error text below field in red, not just red border?
 19. Correct keyboard type (tel, email, numeric)?

 ACCESSIBILITY
 20. Color contrast passes WCAG AA? (Gold never as text on light bg?)
 21. Teal button text is font-semibold or bolder (tight 4.6:1 ratio)?
 22. Focus states visible on keyboard navigation?
 23. All images have meaningful alt text?
 24. Animations respect prefers-reduced-motion?
 25. Decorative overlines have aria-hidden="true"?

 LAYERING
 26. Z-index follows the scale (z-30 nav, z-50 modals, z-[60] toasts)?
 27. No arbitrary z-[999] or z-[9999] values?

 IMAGES (if applicable)
 28. Using next/image with width/height or fill+sizes?
 29. Only above-the-fold images use priority loading?

 Point out any violations and fix them."
```

---

## Design Tokens File (design-tokens.ts)

Keep this as the single source of truth. Every Tailwind config and component references this.

```typescript
export const colors = {
  // Brand
  primary:       '#7B2D42',
  primaryHover:  '#5C2032',
  primaryLight:  '#A04460',  // for dark mode

  // Trust signals
  gold:          '#C5A47E',
  goldMuted:     '#9E7F5A',
  goldLight:     '#D4B896',  // for dark mode

  // Actions
  teal:          '#0E7C7B',
  tealHover:     '#149998',
  tealBright:    '#10A3A0',  // for dark mode CTAs

  // Backgrounds
  background:    '#FEFAF6',
  surface:       '#FFFFFF',
  surfaceMuted:  '#F8F5F0',  // disabled inputs, tag backgrounds

  // Dark mode backgrounds
  darkBg:        '#1A1A24',
  darkSurface:   '#2D2D3A',
  darkElevated:  '#363645',

  // Text
  textPrimary:   '#2E2E38',
  textMuted:     '#6B6B76',
  textOnDark:    '#F0EBE4',
  textMutedDark: '#9090A0',
  placeholder:   'rgba(107, 107, 118, 0.6)',  // input placeholder

  // Borders
  border:        '#E8E0D8',
  borderLight:   '#F0EBE4',
  borderDark:    '#404050',

  // Semantic
  success:       '#059669',
  warning:       '#D97706',
  error:         '#DC2626',
  info:          '#0E7C7B',
} as const

export const fonts = {
  heading: '"Playfair Display", Georgia, "Noto Serif Devanagari", serif',
  body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  hindi: '"Noto Serif Devanagari", "Noto Sans Devanagari", serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const

export const zIndex = {
  content:    0,
  sticky:     10,
  dropdown:   20,
  nav:        30,
  drawer:     40,
  modal:      50,
  toast:      60,
  tooltip:    70,
} as const

export type ColorKey = keyof typeof colors
export type FontKey = keyof typeof fonts
```

---

## MCP & Skill Setup (One-Time)

### 21st.dev MCP
```json
"21st-dev-magic": {
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest"],
  "env": { "API_KEY": "your-21st-dev-api-key" }
}
```

### v0 MCP (Preferred)

1. Add your v0 API key to environment (never paste in code or chat):
```bash
echo 'export V0_API_KEY="your-v0-key-here"' >> ~/.bashrc
source ~/.bashrc
```

2. Add to Claude Code MCP config:
```json
"v0": {
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://mcp.v0.dev",
    "--header",
    "Authorization: Bearer ${V0_API_KEY}"
  ]
}
```

⚠ **Never paste API keys in chat, commits, or documents. Environment variables only.**

### Frontend Design Skill
```bash
npx skills add anthropics/claude-code --skill frontend-design
```

Use at the start of any major UI session:
```
/frontend-design create a design philosophy and component architecture
for the Smart Shaadi matchmaking feed. The platform is an Indian matrimonial
service — warm, trustworthy, premium, family-first. Royal Burgundy + Warm Gold
+ Peacock Teal palette. Playfair Display headings. Not a dating app.
```

### Required Dependencies

Install these before building components. Steps 8 (Motion) and 13 (Icons) depend on them.

**Web (Next.js — Phase 1–4):**
```bash
# Filter matches the "name" field in apps/web/package.json
# If you renamed it to @smart-shaadi/web, update these filters to match
pnpm --filter @vivah/web add framer-motion
pnpm --filter @vivah/web add lucide-react
```

**Google Fonts — complete next/font setup:**
```tsx
// apps/web/src/app/layout.tsx
import { Playfair_Display, Noto_Serif_Devanagari } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const notoDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600'],
  variable: '--font-hindi',
  display: 'swap',
  preload: false, // load only when Hindi content is present
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${notoDevanagari.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

**Mobile (React Native/Expo — Phase 7 only, don't install now):**
```bash
# In apps/mobile when Phase 7 begins:
npx expo install moti react-native-reanimated
# Moti uses Framer Motion-like syntax — minimal learning curve
# Same motion patterns from Step 8 translate directly
```
