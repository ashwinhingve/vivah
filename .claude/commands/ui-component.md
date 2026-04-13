# Smart Shaadi: Build UI Component — $ARGUMENTS
# Usage: /ui-component [component name + context]
# Example: /ui-component profile match card with compatibility score, accept/decline buttons

## The Design-First Rule

Never jump straight to writing JSX. Follow this three-step sequence every time.
A component built without a design plan looks like AI slop. A component built with one looks like a senior designer built it.

---

## Step 1 — Design Intent (say this first)

Before generating any code, state:
- What this component IS (e.g., "a match recommendation card")
- Where it appears (e.g., "the main matchmaking feed, shown 10 at a time")
- What the user DOES with it (e.g., "taps to view full profile, swipes or taps accept/decline")
- What data it shows (e.g., "name, age, city, compatibility score, primary photo")
- What emotional tone it should have (e.g., "warm, trustworthy, not dating-app flashy")

---

## Step 2 — Smart Shaadi Design System

All components must follow these values. Do NOT deviate.

```
Color palette:
  Primary:     #0A1F4D (deep navy) — headings, key actions
  Accent:      #1848C8 (blue) — interactive elements, badges
  Success:     #059669 (green) — match scores, verified badges
  Warning:     #D97706 (amber) — alerts, questions
  Background:  White / #F8F9FC (light gray surfaces)
  Text:        #0F172A (near-black) | #64748B (muted)

Typography:
  Font:        System sans-serif stack (no Google Fonts — performance)
  Headings:    font-semibold, tight tracking
  Body:        text-sm or text-base, leading-relaxed

Spacing:
  Base unit:   4px (Tailwind default)
  Cards:       p-4 or p-5
  Sections:    gap-4 or gap-6
  Page:        max-w-screen-lg mx-auto px-4

Radius:
  Cards:       rounded-xl
  Badges:      rounded-full
  Buttons:     rounded-lg

Shadows:
  Cards:       shadow-sm (subtle — no heavy drop shadows)
  Hover:       shadow-md

Mobile-first:
  Everything works on 375px screen width
  Touch targets minimum 44×44px
  Bottom navigation for mobile (not sidebar)
```

---

## Step 3 — Component Generation

After defining intent and confirming design system alignment:

```
"Using the Smart Shaadi design system above, generate a [component name] component.
 Use shadcn/ui primitives where available.
 Use Tailwind CSS v4 utility classes only — no inline styles.
 The component must be a Server Component unless it needs:
   - onClick / onSubmit handlers
   - useState / useEffect
   - browser APIs
 If client-side, name the file [ComponentName].client.tsx"
```

### Pull from 21st.dev (use /ui command in Claude Code)

For complex interactive patterns — sliders, carousels, animated cards, charts — use:
```
/ui [describe what you need]
```
21st.dev MCP gives Claude Code access to a library of polished Tailwind + React components.
Ask for the component, then adapt it to the Smart Shaadi design system (colours, radius, typography).

---

## Smart Shaadi Core Screens — Reference

These are the screens that matter most. Build them well.

| Screen | Key Components |
|--------|---------------|
| Match Feed | MatchCard, CompatibilityBadge, AcceptDeclineButtons, GunaScore |
| Profile View | ProfileHero, PhotoGallery, CompatibilityBreakdown, SafetyModeBadge |
| Chat | MessageBubble, TranslationToggle, PhotoMessage, ReadReceipt |
| Wedding Dashboard | BudgetDonut, TaskKanban, CountdownTimer, VendorGrid |
| Guest List | GuestRow, RSVPBadge, MealPrefTag, RoomBadge |
| Vendor Card | VendorPortfolioCard, StarRating, PriceRange, BookNowButton |
| Booking Flow | BookingSteps, DatePicker, EscrowInfo, PaymentSummary |
| Admin Dashboard | StatCard, AlertBanner, VendorApprovalRow, MetricsChart |

---

## Quality Check (Run Before Every Component is "Done")

Ask Claude Code:

```
"Review this component against these checks:
 1. Does it work on a 375px mobile screen without horizontal scroll?
 2. Are all touch targets at least 44×44px?
 3. Does it follow the Smart Shaadi design system (navy/blue/green palette, rounded-xl cards)?
 4. Is there a loading state if data might take > 200ms?
 5. Is there an empty state if the list could be empty?
 6. Are error states handled visually?
 7. Is contact information (phone/email) masked by default?
 Point out any violations and fix them."
```

---

## Install 21st.dev MCP (One-Time Setup)

1. Go to [21st.dev/magic](https://21st.dev/magic)
2. Sign in and copy your personal MCP server command
3. In Claude Code, type: `"Install this MCP server: [paste command]"`
4. Or add manually to `~/.claude/claude_desktop_config.json`:

```json
"21st-dev-magic": {
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest"],
  "env": {
    "API_KEY": "your-21st-dev-api-key"
  }
}
```

## Install Frontend Design Skill (One-Time Setup)

```bash
npx skills add anthropics/claude-code --skill frontend-design
```

After installing, use it at the start of any major UI planning session:
```
/frontend-design create a design philosophy and component architecture
for the Smart Shaadi matchmaking feed. The platform is an Indian matrimonial
service — warm, trustworthy, not dating-app flashy. Avoid generic AI layouts.
```
