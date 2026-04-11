# Smart Shaadi: Build UI Component — $ARGUMENTS
# Usage: /ui-component [component name + context]
# Example: /ui-component match feed card with Guna Milan score and accept/decline

## The Design-First Rule
Never jump straight to JSX. Always state intent first.
A component built without a plan looks like AI slop. One built with one looks handcrafted.

---

## Step 1 — State Intent Before Generating

Tell me:
- What this component IS ("a match recommendation card")
- Where it appears ("main matchmaking feed, 10 at a time")
- What the user DOES with it ("taps to view full profile, accepts or declines")
- What data it shows ("name, age, city, Guna score, compatibility %, primary photo")
- Emotional tone ("warm, trustworthy, auspicious — not dating-app flashy")

---

## Step 2 — Smart Shaadi Design System (DO NOT DEVIATE)

```
COLOURS:
Primary brand:   #7B2D42  Royal Burgundy   — headings, brand moments, Guna Milan score
Accent gold:     #C5A47E  Warm Gold        — badge borders, decorative accents ONLY
CTA / action:    #0E7C7B  Peacock Teal     — ALL buttons, verified badges, match %, scores
Hover Burgundy:  #5C2032  | Hover Teal: #149998  | Gold text: #9E7F5A
Page background: #FEFAF6  Warm Ivory       — NEVER plain white for page bg
Card surface:    #FFFFFF  Pure White       — card interiors only
Dark surface:    #2D2D3A                   — nav, footer
Primary text:    #2E2E38  | Secondary: #6B6B76

TYPOGRAPHY:
Headings:   font-[Playfair_Display] font-semibold — premium matrimonial weight
Body:       font-sans (Inter or system-ui) — clean and readable
Sizes:      Display: text-3xl | H1: text-2xl | H2: text-xl | Body: text-base | Caption: text-sm

COMPONENTS:
Cards:         bg-white rounded-xl shadow-sm border border-[#C5A47E]/20 p-4 or p-5
CTA Button:    bg-[#0E7C7B] hover:bg-[#149998] text-white rounded-lg min-h-[44px] px-6
Brand Button:  bg-[#7B2D42] hover:bg-[#5C2032] text-white rounded-lg min-h-[44px] px-6
Ghost Button:  border border-[#0E7C7B] text-[#0E7C7B] hover:bg-[#0E7C7B]/5 rounded-lg
Gold Badge:    bg-[#C5A47E]/15 text-[#9E7F5A] border border-[#C5A47E]/40 rounded-full text-xs px-2
Verified:      bg-[#0E7C7B] text-white rounded-full text-xs px-2 — Teal = trust
Guna Score:    text-[#7B2D42] font-bold — Burgundy = auspicious
Match Score:   text-[#0E7C7B] font-bold — Teal = action/positive

LAYOUT:
Mobile-first: min-width 375px always
Touch targets: 44×44px minimum — all interactive elements
Bottom nav:   Mobile gets bottom nav bar (not sidebar)
Page bg:      Always bg-[#FEFAF6] — never bg-white for pages
Cards on ivory: white cards on ivory background = warm depth
```

---

## Step 3 — Smart Shaadi Core Screens Reference

| Screen | Key Components Needed |
|--------|----------------------|
| Match Feed | MatchCard, CompatibilityBadge (Teal), GunaScore (Burgundy), AcceptDeclineButtons |
| Profile View | ProfileHero, PhotoGallery, CompatibilityBreakdown, SafetyModeBadge (Gold) |
| Chat | MessageBubble, TranslationToggle, PhotoMessage, ReadReceipt, TypingIndicator |
| Wedding Dashboard | BudgetDonut (Teal fill), TaskKanban, CountdownTimer, CeremonyTimeline |
| Guest List | GuestRow, RSVPBadge, MealPrefTag, RoomBadge, StatsBar |
| Vendor Card | VendorPortfolioCard, StarRating (Gold), PriceRange, BookButton (Teal) |
| Booking Flow | BookingSteps, DatePicker, EscrowInfoCard, PaymentSummary |
| Dashboard | StatCard (Teal numbers), AlertBanner, MetricsChart, ActionList |
| Subscription | PricingCard (PREMIUM: Burgundy border), FeatureList, UpgradeButton (Teal) |

---

## Step 4 — Generation Rules

After intent is stated:
```
"Using the Smart Shaadi design system (Royal Burgundy #7B2D42 · Warm Gold #C5A47E · 
Peacock Teal #0E7C7B · Ivory background #FEFAF6), generate [component name].

Requirements:
- Server Component by default — .client.tsx only if needs hooks/browser events
- shadcn/ui primitives as base components
- Tailwind v4 utility classes ONLY — no inline styles
- Playfair Display for headings, system-ui for body
- Mobile-first, 375px minimum, all touch targets 44px"
```

### Pull Complex Patterns from 21st.dev
For carousels, animated transitions, complex forms, data visualizations:
```
/ui [describe what you need]
```
Then adapt the result to Smart Shaadi design system (replace their colours with ours).

---

## Step 5 — Quality Check Before Done

Run this before every component is marked complete:

```
"Review this component against Smart Shaadi quality standards:
1. Works at 375px mobile width without horizontal scroll?
2. All touch targets ≥ 44×44px?
3. Uses correct colours: Teal for CTAs, Burgundy for brand, Gold for decorative only?
4. Page background is #FEFAF6 (warm ivory), not plain white?
5. Playfair Display for headings?
6. Loading state implemented?
7. Empty state implemented?
8. Error state implemented?
9. Phone/email not shown (Safety Mode respected)?
10. Server Component unless genuinely needs browser APIs?
Point out any violations."
```

---

## One-Time Setup (Run Once in Terminal)

```bash
# Install frontend-design skill
npx skills add anthropics/claude-code --skill frontend-design

# Use at start of any major UI planning session:
/frontend-design create a design philosophy for Smart Shaadi Infinity.
It is an Indian matrimonial platform — warm, trustworthy, premium.
Colour: Royal Burgundy #7B2D42 + Warm Gold #C5A47E + Peacock Teal #0E7C7B.
Background: Warm Ivory #FEFAF6. Typography: Playfair Display headings.
Avoid Western wedding minimalism. Avoid dating-app flashy.
```

## 21st.dev Magic MCP (Add to claude.json)

```json
"21st-dev-magic": {
  "command": "cmd",
  "args": ["/c", "npx", "-y", "@21st-dev/magic@latest"],
  "env": { "API_KEY": "your-key-from-21st.dev/magic" }
}
```
