# Phase 1 — Navigation Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the marketing navbar (desktop dropdowns + mobile slide-in drawer), cap/polish the logged-in web nav, and refine the RN floating tab bar with a chat unread badge — per the approved spec `docs/superpowers/specs/2026-07-29-navigation-and-ui-polish-design.md`.

**Architecture:** Marketing nav gains a Radix `NavigationMenu` primitive (new shadcn port) with two dropdown panels driven by a static data module; the mobile menu becomes a right-side drawer on the existing `Sheet` primitive. Logged-in nav config splits per-role primary items into desktop/mobile sets with a pure `splitPrimary` helper (unit-tested). RN tab bar reads a new `useUnreadTotal` TanStack-Query hook and renders a badge on the Chat tab.

**Tech Stack:** Next.js 15, next-intl, Radix UI, Tailwind v4 tokens, framer-motion (web) · React Native 0.86, Expo Router, NativeWind v4, TanStack Query, RNTL/jest (mobile).

**Environment facts (this machine):**
- Run all pnpm/node/git through WSL: `wsl.exe -d Ubuntu-24.04-New bash -lc "cd /home/ashwin/vivahOS && <cmd>"`. Repo root inside WSL: `/home/ashwin/vivahOS`.
- The working tree carries **uncommitted audit files** (`apps/api/src/lib/cors.ts`, its test, three docs, one new script). NEVER `git add -A`. Every commit adds only the exact paths named in its step.
- Web message catalogs are fragment-merged: never hand-edit `messages/en.json`/`hi.json`; write a fragment and run `node messages/merge-fragment.mjs <name>` (additive, idempotent).
- Browser QA uses Playwright MCP against `http://localhost:3007`. Marketing pages need no DB. Logged-in pages need Postgres:5433 + Redis:6379, which require the operator's sudo to start — Task 13 blocks on that.
- Turbo caches lie: always `pnpm exec turbo type-check --force` (never `pnpm type-check -- --force`).

---

### Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout -b feat/nav-ui-phase1
git status --short   # audit files still modified/untracked — expected, leave them
```

Expected: `Switched to a new branch 'feat/nav-ui-phase1'`; status shows the pre-existing audit files only.

---

### Task 1: NavigationMenu primitive

**Files:**
- Modify: `apps/web/package.json` (dependency, via pnpm)
- Create: `apps/web/src/components/ui/navigation-menu.tsx`

- [ ] **Step 1: Install the Radix dependency**

```bash
pnpm --filter @smartshaadi/web add @radix-ui/react-navigation-menu
```

Expected: lockfile updated, `@radix-ui/react-navigation-menu` in apps/web/package.json dependencies.

- [ ] **Step 2: Create the primitive** — `apps/web/src/components/ui/navigation-menu.tsx`:

```tsx
'use client';

import * as React from 'react';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * shadcn NavigationMenu port, styled to the Smart Shaadi design system.
 * The Viewport is rendered by <NavigationMenu> itself — consumers only
 * compose List/Item/Trigger/Content/Link.
 */
const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn('relative z-10 flex max-w-max flex-1 items-center justify-center', className)}
    {...props}
  >
    {children}
    <NavigationMenuViewport />
  </NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
    {...props}
  />
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
  'group inline-flex h-10 w-max items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm ' +
    'text-foreground/75 transition-colors hover:text-primary focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ' +
    'data-[state=open]:text-primary'
);

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), className)}
    {...props}
  >
    {children}
    <ChevronDown
      className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
      aria-hidden="true"
    />
  </NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      'left-0 top-0 w-full p-3 md:absolute md:w-auto',
      'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out',
      className
    )}
    {...props}
  />
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <div className="absolute left-0 top-full flex w-full justify-center">
    <NavigationMenuPrimitive.Viewport
      ref={ref}
      className={cn(
        'relative mt-3 h-[var(--radix-navigation-menu-viewport-height)] w-full origin-top-center overflow-hidden ' +
          'rounded-2xl border border-gold/25 bg-surface text-foreground shadow-[var(--shadow-lg)] ' +
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
          'md:w-[var(--radix-navigation-menu-viewport-width)] motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName = NavigationMenuPrimitive.Viewport.displayName;

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
```

- [ ] **Step 3: Type-check**

```bash
pnpm --filter @smartshaadi/web type-check
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/navigation-menu.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add NavigationMenu primitive for marketing nav dropdowns"
```

---

### Task 2: i18n fragment for new nav keys

**Files:**
- Create: `apps/web/messages/fragments/nav-phase1.en.json`
- Create: `apps/web/messages/fragments/nav-phase1.hi.json`
- Generated: `apps/web/messages/en.json`, `apps/web/messages/hi.json` (via merge script only)

- [ ] **Step 1: Write the English fragment** — `apps/web/messages/fragments/nav-phase1.en.json`:

```json
{
  "marketing": {
    "navbar": {
      "browse": "Browse",
      "menu": {
        "gunaMilan": "Guna Milan Compatibility",
        "gunaMilanDesc": "8-factor Vedic Ashtakoot scoring you can inspect",
        "aiMatch": "AI Matchmaking",
        "aiMatchDesc": "Reciprocal matches, explained in plain language",
        "families": "For Families",
        "familiesDesc": "Parent Mode, shared shortlists, family verification",
        "safety": "Safety & Privacy",
        "safetyDesc": "Verified profiles, masked contacts, privacy by default",
        "vendorsDesc": "Venues, photographers, caterers and more",
        "helpCentre": "Help Centre",
        "helpDesc": "Guides and answers to common questions",
        "aboutUs": "About Us",
        "aboutDesc": "Why Smart Shaadi exists",
        "popularSearches": "Popular searches",
        "popular": {
          "hindu": "Hindu Matrimony",
          "sikh": "Sikh Matrimony",
          "delhi": "Marriages in Delhi",
          "mumbai": "Marriages in Mumbai",
          "bangalore": "Marriages in Bangalore",
          "jaipur": "Marriages in Jaipur"
        }
      }
    }
  },
  "nav": {
    "app": {
      "groupQuickAccess": "Quick access"
    }
  }
}
```

- [ ] **Step 2: Write the Hindi fragment** — `apps/web/messages/fragments/nav-phase1.hi.json`:

```json
{
  "marketing": {
    "navbar": {
      "browse": "ब्राउज़ करें",
      "menu": {
        "gunaMilan": "गुण मिलान अनुकूलता",
        "gunaMilanDesc": "8-कारक वैदिक अष्टकूट स्कोर, जिसे आप स्वयं परख सकते हैं",
        "aiMatch": "AI मैचमेकिंग",
        "aiMatchDesc": "दोतरफ़ा मैच, सरल भाषा में समझाए गए",
        "families": "परिवारों के लिए",
        "familiesDesc": "पैरेंट मोड, साझा शॉर्टलिस्ट, पारिवारिक सत्यापन",
        "safety": "सुरक्षा और निजता",
        "safetyDesc": "सत्यापित प्रोफ़ाइल, छिपे संपर्क, डिफ़ॉल्ट रूप से निजता",
        "vendorsDesc": "वेन्यू, फ़ोटोग्राफ़र, कैटरर और बहुत कुछ",
        "helpCentre": "सहायता केंद्र",
        "helpDesc": "गाइड और आम सवालों के जवाब",
        "aboutUs": "हमारे बारे में",
        "aboutDesc": "स्मार्ट शादी क्यों बनी",
        "popularSearches": "लोकप्रिय खोजें",
        "popular": {
          "hindu": "हिंदू मैट्रिमोनी",
          "sikh": "सिख मैट्रिमोनी",
          "delhi": "दिल्ली में विवाह",
          "mumbai": "मुंबई में विवाह",
          "bangalore": "बैंगलोर में विवाह",
          "jaipur": "जयपुर में विवाह"
        }
      }
    }
  },
  "nav": {
    "app": {
      "groupQuickAccess": "त्वरित पहुँच"
    }
  }
}
```

- [ ] **Step 3: Merge the fragment (never hand-edit en/hi.json)**

```bash
cd apps/web && node messages/merge-fragment.mjs nav-phase1
```

Expected: reports N keys added to each catalog, 0 conflicts. Re-run once — expected: 0 added (idempotent).

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/fragments/nav-phase1.en.json apps/web/messages/fragments/nav-phase1.hi.json apps/web/messages/en.json apps/web/messages/hi.json
git commit -m "feat(web): i18n keys for nav dropdowns, drawer, quick-access group"
```

---

### Task 3: Marketing nav data module

**Files:**
- Create: `apps/web/src/components/marketing/nav-links.ts`

- [ ] **Step 1: Create the data module** — `apps/web/src/components/marketing/nav-links.ts`:

```ts
import { Gem, Sparkles, Users, ShieldCheck, Store, LifeBuoy, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Marketing navbar structure — single source for the desktop dropdowns and the
 * mobile drawer. Anchor links use full `/#id` paths so they work from /vendors,
 * /about, etc., not just the home page. All ids exist on (marketing)/page.tsx:
 * how-it-works · features · for-families · pricing.
 */
export type MarketingNavLink = { labelKey: string; href: string };
export type MarketingMenuItem = {
  labelKey: string;   // under marketing.navbar.menu
  descKey: string;    // under marketing.navbar.menu
  href: string;
  Icon: LucideIcon;
};

export const PLAIN_LINKS_BEFORE: MarketingNavLink[] = [
  { labelKey: 'howItWorks', href: '/#how-it-works' },
];

export const PLAIN_LINKS_AFTER: MarketingNavLink[] = [
  { labelKey: 'pricing', href: '/#pricing' },
];

export const FEATURES_MENU: MarketingMenuItem[] = [
  { labelKey: 'gunaMilan', descKey: 'gunaMilanDesc', href: '/#features',     Icon: Gem },
  { labelKey: 'aiMatch',   descKey: 'aiMatchDesc',   href: '/#how-it-works', Icon: Sparkles },
  { labelKey: 'families',  descKey: 'familiesDesc',  href: '/#for-families', Icon: Users },
  { labelKey: 'safety',    descKey: 'safetyDesc',    href: '/about',         Icon: ShieldCheck },
];

export const BROWSE_MENU: MarketingMenuItem[] = [
  { labelKey: 'vendors',   descKey: 'vendorsDesc', href: '/vendors', Icon: Store },
  { labelKey: 'helpCentre',descKey: 'helpDesc',    href: '/help',    Icon: LifeBuoy },
  { labelKey: 'aboutUs',   descKey: 'aboutDesc',   href: '/about',   Icon: Info },
];

// SEO landing pages (src/lib/seo-data.ts slugs → URL patterns from
// (public)/[slug]/page.tsx: '<community>-matrimony' and 'marriages-in-<city>').
// Keys under marketing.navbar.menu.popular.
export const POPULAR_SEARCHES: MarketingNavLink[] = [
  { labelKey: 'hindu',     href: '/hindu-matrimony' },
  { labelKey: 'sikh',      href: '/sikh-matrimony' },
  { labelKey: 'delhi',     href: '/marriages-in-delhi' },
  { labelKey: 'mumbai',    href: '/marriages-in-mumbai' },
  { labelKey: 'bangalore', href: '/marriages-in-bangalore' },
  { labelKey: 'jaipur',    href: '/marriages-in-jaipur' },
];
```

**⚠ Before committing, verify the two URL patterns against the actual matcher** in `apps/web/src/app/[locale]/(public)/[slug]/page.tsx` (the seo-data comments say `'hindu' → /hindu-matrimony`, `'bhopal' → /marriages-in-bhopal`; confirm and also confirm the vendors label key: the trigger for Browse uses `marketing.navbar.browse`, while the Wedding Vendors row uses the existing `marketing.navbar.vendors` label — it resolves at the same level as `menu`, so in the component the row label for `vendors` is `t('vendors')`, NOT `t('menu.vendors')`. Every other row label/desc is under `t('menu.…')`.)

- [ ] **Step 2: Type-check, then commit**

```bash
pnpm --filter @smartshaadi/web type-check
git add apps/web/src/components/marketing/nav-links.ts
git commit -m "feat(web): marketing nav data module (dropdown groups + popular searches)"
```

---

### Task 4: Desktop dropdowns in the marketing Navbar

**Files:**
- Modify: `apps/web/src/components/marketing/Navbar.client.tsx` (desktop link list only — lines 108–129 in the current file; hamburger/overlay untouched until Task 5)

- [ ] **Step 1: Replace the flat desktop `<ul>` with NavigationMenu.** In `Navbar.client.tsx`, add imports:

```tsx
import { Link } from '@/i18n/navigation'; // already imported
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
  PLAIN_LINKS_BEFORE,
  PLAIN_LINKS_AFTER,
  FEATURES_MENU,
  BROWSE_MENU,
  POPULAR_SEARCHES,
  type MarketingMenuItem,
} from './nav-links';
```

Delete the old `navLinks` array and `desktopLinkClass` const. Replace the desktop `<ul className="hidden items-center gap-6 md:flex md:justify-self-center">…</ul>` block with:

```tsx
{/* Desktop nav — plain links + two dropdown panels */}
<NavigationMenu className="hidden md:flex md:justify-self-center">
  <NavigationMenuList>
    {PLAIN_LINKS_BEFORE.map((link) => (
      <NavigationMenuItem key={link.href}>
        <NavigationMenuLink asChild>
          <Link href={link.href} className={navigationMenuTriggerStyle()}>
            {t(link.labelKey)}
          </Link>
        </NavigationMenuLink>
      </NavigationMenuItem>
    ))}

    <NavigationMenuItem>
      <NavigationMenuTrigger>{t('features')}</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[26rem] gap-1 p-1" role="list">
          {FEATURES_MENU.map((item) => (
            <li key={item.href + item.labelKey}>
              <MenuRow item={item} />
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>

    <NavigationMenuItem>
      <NavigationMenuTrigger>{t('browse')}</NavigationMenuTrigger>
      <NavigationMenuContent>
        <div className="grid w-[34rem] grid-cols-[1.2fr_1fr] gap-3 p-1">
          <ul className="grid gap-1" role="list">
            {BROWSE_MENU.map((item) => (
              <li key={item.href}>
                <MenuRow item={item} topLevelLabel={item.labelKey === 'vendors'} />
              </li>
            ))}
          </ul>
          <div className="rounded-xl bg-background p-3">
            <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-gold-muted">
              {t('menu.popularSearches')}
            </p>
            <ul className="grid gap-0.5" role="list">
              {POPULAR_SEARCHES.map((link) => (
                <li key={link.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={link.href}
                      className="block rounded-lg px-2 py-1.5 text-sm text-foreground/75 transition-colors hover:bg-gold/10 hover:text-primary"
                    >
                      {t(`menu.popular.${link.labelKey}`)}
                    </Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>

    {PLAIN_LINKS_AFTER.map((link) => (
      <NavigationMenuItem key={link.href}>
        <NavigationMenuLink asChild>
          <Link href={link.href} className={navigationMenuTriggerStyle()}>
            {t(link.labelKey)}
          </Link>
        </NavigationMenuLink>
      </NavigationMenuItem>
    ))}
  </NavigationMenuList>
</NavigationMenu>
```

And add the row component at the bottom of the file (same file — it needs `useTranslations` scope, so pass `t`; simplest is defining it INSIDE `Navbar()` above the return, as a closure over `t`):

```tsx
// Inside Navbar(), before `return`:
function MenuRow({ item, topLevelLabel = false }: { item: MarketingMenuItem; topLevelLabel?: boolean }) {
  const { Icon } = item;
  return (
    <NavigationMenuLink asChild>
      <Link
        href={item.href}
        className="group/row flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-primary">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground group-hover/row:text-primary">
            {topLevelLabel ? t(item.labelKey) : t(`menu.${item.labelKey}`)}
          </span>
          <span className="block pt-0.5 text-xs text-muted-foreground">{t(`menu.${item.descKey}`)}</span>
        </span>
      </Link>
    </NavigationMenuLink>
  );
}
```

**Watch out:** the description class is `text-muted-foreground` — NOT `text-muted` (that token is a surface tint and renders invisible; see docs/audit-2026 finding U1-b).

- [ ] **Step 2: The mobile overlay still references the deleted `navLinks`.** Until Task 5 replaces it, make the overlay compile by mapping over `[...PLAIN_LINKS_BEFORE, ...PLAIN_LINKS_AFTER, { labelKey: 'vendors', href: '/vendors' }]` in place of `navLinks` (all non-hash now, so use `Link` for every row and drop the `startsWith('#')` branch). This is throwaway glue removed in Task 5.

- [ ] **Step 3: Type-check + visual smoke**

```bash
pnpm --filter @smartshaadi/web type-check
```

Then with dev running on :3007, load `http://localhost:3007/en` at 1440×900 (Playwright MCP), hover/click "Features" and "Browse", screenshot each open panel. Expected: ivory panel under the pill, 4 icon rows / 3 rows + popular column, chevron rotates, Escape closes, no console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/Navbar.client.tsx
git commit -m "feat(web): marketing navbar desktop dropdowns (Features, Browse)"
```

---

### Task 5: Mobile drawer replaces the full-screen overlay

**Files:**
- Create: `apps/web/src/components/marketing/MobileNavDrawer.client.tsx`
- Modify: `apps/web/src/components/marketing/Navbar.client.tsx` (remove overlay + isOpen state + body-scroll-lock effect; keep `scrolled` effect)

- [ ] **Step 1: Create the drawer** — `apps/web/src/components/marketing/MobileNavDrawer.client.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LogoFull } from './Logo';
import { LanguageToggle } from '@/components/i18n/LanguageToggle.client';
import {
  PLAIN_LINKS_BEFORE,
  PLAIN_LINKS_AFTER,
  FEATURES_MENU,
  BROWSE_MENU,
  type MarketingMenuItem,
  type MarketingNavLink,
} from './nav-links';

/**
 * Mobile marketing menu — right-side drawer on the Sheet primitive (focus trap,
 * scroll lock, Escape and backdrop close come from Radix Dialog). Replaces the
 * old full-screen overlay. Controlled state so link taps close the drawer.
 */
export function MobileNavDrawer() {
  const t = useTranslations('marketing.navbar');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/5 md:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-[85vw] max-w-[360px] flex-col gap-0 rounded-l-2xl border-l border-gold/25 p-0 md:hidden"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>

        {/* Header */}
        <div className="flex h-16 shrink-0 items-center border-b border-gold/20 px-5">
          <LogoFull />
          {/* SheetContent renders its own top-right close button */}
        </div>

        {/* Scrollable groups */}
        <nav aria-label="Mobile navigation" className="flex-1 overflow-y-auto px-3 py-4">
          <DrawerPlainRow link={PLAIN_LINKS_BEFORE[0]!} label={t('howItWorks')} onNavigate={close} />

          <DrawerGroup title={t('features')}>
            {FEATURES_MENU.map((item) => (
              <DrawerMenuRow key={item.labelKey} item={item} label={t(`menu.${item.labelKey}`)} onNavigate={close} />
            ))}
          </DrawerGroup>

          <DrawerGroup title={t('browse')}>
            {BROWSE_MENU.map((item) => (
              <DrawerMenuRow
                key={item.labelKey}
                item={item}
                label={item.labelKey === 'vendors' ? t('vendors') : t(`menu.${item.labelKey}`)}
                onNavigate={close}
              />
            ))}
          </DrawerGroup>

          <DrawerPlainRow link={PLAIN_LINKS_AFTER[0]!} label={t('pricing')} onNavigate={close} />
        </nav>

        {/* Pinned CTA footer — pb clears the demo-mode chip + home indicator */}
        <div className="shrink-0 space-y-2.5 border-t border-gold/20 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4">
          <div className="flex justify-center pb-1">
            <LanguageToggle />
          </div>
          <Link
            href="/login"
            onClick={close}
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-gold/35 bg-gold/5 font-medium text-primary transition-colors hover:bg-gold/15"
          >
            {t('login')}
          </Link>
          <Link
            href="/register"
            onClick={close}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary text-center font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-colors hover:bg-primary-hover"
          >
            {t('register')}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="px-3 pb-1 text-2xs font-semibold uppercase tracking-widest text-gold-muted">{title}</h3>
      <ul role="list">{children}</ul>
    </section>
  );
}

function DrawerMenuRow({
  item,
  label,
  onNavigate,
}: {
  item: MarketingMenuItem;
  label: string;
  onNavigate: () => void;
}) {
  const { Icon } = item;
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-primary" aria-hidden="true">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </Link>
    </li>
  );
}

function DrawerPlainRow({
  link,
  label,
  onNavigate,
}: {
  link: MarketingNavLink;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="flex min-h-[48px] items-center rounded-xl px-3 font-heading text-base font-semibold text-primary transition-colors hover:bg-gold/10"
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: Gut the old overlay from `Navbar.client.tsx`.** Remove: `isOpen` state, the body-scroll-lock/Escape `useEffect`, the hamburger `<button>`, the entire `{isOpen && (…mobile menu…)}` block, the Task 4 Step 2 throwaway glue, and now-unused imports (`useState` if unused, `X`, `Menu`). In the hamburger's place render `<MobileNavDrawer />` (import it). Keep the `scrolled` effect and pill exactly as-is.

- [ ] **Step 3: Type-check + visual check** — `pnpm --filter @smartshaadi/web type-check`, then at 375×812 open the drawer: slides from right, groups + icons render, tap "Pricing" closes and scrolls, CTA footer not overlapped by the demo chip, Escape/backdrop close. Screenshot open drawer.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/Navbar.client.tsx apps/web/src/components/marketing/MobileNavDrawer.client.tsx
git commit -m "feat(web): replace marketing mobile overlay with slide-in nav drawer"
```

---

### Task 6: Marketing browser QA (no DB needed)

**Files:** none (evidence only)

- [ ] **Step 1: Full pass at both widths** via Playwright MCP on `http://localhost:3007/en`:
  - 1440×900: both dropdowns open/close (hover AND keyboard: Tab to trigger, Enter opens, arrow through rows, Escape closes); every dropdown link navigates (spot-check `/vendors`, `/hindu-matrimony`, `/#for-families` from the /vendors page — must land home and scroll); active pill styling on scroll still compresses.
  - 375×812: drawer open/close/link-tap-close; no horizontal scroll; console clean on every page visited.
- [ ] **Step 2: Also check `/hi` locale once** (drawer + one dropdown) — Hindi labels render, no missing-key warnings in console.
- [ ] **Step 3: Save screenshots** to the session scratchpad (NOT the repo root), note results for the final report.

---

### Task 7: nav-config split (`primaryMobile` + `splitPrimary`) — TDD

**Files:**
- Create: `apps/web/src/components/layout/__tests__/nav-config.test.ts`
- Modify: `apps/web/src/components/layout/nav-config.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/layout/__tests__/nav-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { navForRole, splitPrimary } from '../nav-config';

describe('splitPrimary', () => {
  it('returns primary unchanged with empty overflow when no mobile set exists', () => {
    const { primary, primaryMobile } = navForRole('INDIVIDUAL');
    const { mobile, overflow } = splitPrimary(primary, primaryMobile);
    expect(mobile).toEqual(primary);
    expect(overflow).toEqual([]);
  });

  it('VENDOR mobile set is capped at 4 with the rest as overflow', () => {
    const { primary, primaryMobile } = navForRole('VENDOR');
    const { mobile, overflow } = splitPrimary(primary, primaryMobile);
    expect(mobile.map((i) => i.href)).toEqual([
      '/vendor-dashboard',
      '/bookings',
      '/vendor-dashboard/orders',
      '/profile/personal',
    ]);
    expect(overflow.map((i) => i.href)).toEqual([
      '/vendor-dashboard/store',
      '/vendor/payouts',
      '/payments/links',
    ]);
  });

  it('every overflow item still exists in desktop primary (nothing lost)', () => {
    const { primary, primaryMobile } = navForRole('VENDOR');
    const { overflow } = splitPrimary(primary, primaryMobile);
    const primaryHrefs = new Set(primary.map((i) => i.href));
    for (const item of overflow) expect(primaryHrefs.has(item.href)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @smartshaadi/web exec vitest run src/components/layout/__tests__/nav-config.test.ts
```

Expected: FAIL — `splitPrimary` is not exported / `primaryMobile` undefined on return type.

- [ ] **Step 3: Implement in `nav-config.ts`.** Add after `VENDOR_PRIMARY`:

```ts
// Phone bottom bar carries at most 4 primary items + More. VENDOR's 7 squeeze
// into ~45px columns at 360px, so it gets an explicit mobile set; overflow
// items surface in the More sheet's "Quick access" group (see splitPrimary).
const VENDOR_PRIMARY_MOBILE: NavItem[] = [
  { href: '/vendor-dashboard',        labelKey: 'home',     Icon: Home },
  { href: '/bookings',                labelKey: 'bookings', Icon: Calendar },
  { href: '/vendor-dashboard/orders', labelKey: 'orders',   Icon: ShoppingCart },
  { href: '/profile/personal',        labelKey: 'profile',  Icon: User },
];
```

Change `navForRole`'s return type and each branch:

```ts
export function navForRole(role: string): {
  primary: NavItem[];
  primaryMobile?: NavItem[];
  moreGroups: NavGroup[];
} {
  switch (role as UserRole) {
    // …all branches unchanged except:
    case 'VENDOR':
      return { primary: VENDOR_PRIMARY, primaryMobile: VENDOR_PRIMARY_MOBILE, moreGroups: VENDOR_MORE_GROUPS };
    // …
  }
}
```

Add below `activeNavHref`:

```ts
// Mobile carries `primaryMobile` when defined; anything in desktop-primary but
// not in the mobile set is "overflow" and must resurface in the More sheet.
export function splitPrimary(
  primary: NavItem[],
  primaryMobile?: NavItem[],
): { mobile: NavItem[]; overflow: NavItem[] } {
  if (!primaryMobile || primaryMobile.length === 0) return { mobile: primary, overflow: [] };
  const mobileHrefs = new Set(primaryMobile.map((i) => i.href));
  return { mobile: primaryMobile, overflow: primary.filter((i) => !mobileHrefs.has(i.href)) };
}
```

- [ ] **Step 4: Run tests — expect 3 passing.** Same command as Step 2.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/nav-config.ts apps/web/src/components/layout/__tests__/nav-config.test.ts
git commit -m "feat(web): per-role mobile primary nav set with splitPrimary helper"
```

---

### Task 8: Wire the split into AppNav + TopNav

**Files:**
- Modify: `apps/web/src/components/layout/AppNav.client.tsx`
- Modify: `apps/web/src/components/layout/TopNav.client.tsx`

- [ ] **Step 1: AppNav (phone bottom bar + More sheet).** Import `splitPrimary`. Replace:

```ts
const { primary: primaryRaw, moreGroups: moreGroupsRaw } = navForRole(role);
```

with:

```ts
const { primary: desktopPrimary, primaryMobile, moreGroups: moreGroupsRaw } = navForRole(role);
const { mobile: primaryRaw, overflow } = splitPrimary(desktopPrimary, primaryMobile);
```

and build the sheet groups with overflow first:

```ts
const moreGroups: NavGroup[] = [
  ...(overflow.length > 0 ? [{ titleKey: 'groupQuickAccess', items: overflow }] : []),
  ...moreGroupsRaw,
]
  .map((g) => ({ ...g, items: filterForDemo(g.items) }))
  .filter((g) => g.items.length > 0);
```

Everything downstream (`primary = filterForDemo(primaryRaw)`, `moreItems`, `currentHref`) is unchanged — the overflow items now participate in More-sheet active-state automatically.

- [ ] **Step 2: TopNav (desktop) — tablet overflow cap.** In the `items.map`, add the index param and gate items ≥ 4:

```tsx
{items.map(({ href, labelKey, Icon }, i) => {
  const isActive = href === currentHref;
  return (
    <Link
      key={href}
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        i >= 4 && 'hidden lg:inline-flex',
        isActive ? 'bg-teal/10 text-teal' : 'text-fg-1 hover:bg-surface-muted',
      )}
    >
      <Icon strokeWidth={1.75} className="h-4 w-4" aria-hidden />
      {t(labelKey)}
    </Link>
  );
})}
```

And inside `DropdownMenuContent`, BEFORE the `groups.map`, add a `lg:hidden` quick-access group so the CSS-hidden items stay reachable at md widths:

```tsx
{items.length > 4 && (
  <div className="lg:hidden">
    <DropdownMenuLabel className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
      {t('groupQuickAccess')}
    </DropdownMenuLabel>
    {items.slice(4).map(({ href, labelKey, Icon }) => (
      <DropdownMenuItem
        key={href}
        onSelect={() => router.push(href)}
        className="flex cursor-pointer items-center gap-2.5"
      >
        <Icon strokeWidth={1.75} className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t(labelKey)}
      </DropdownMenuItem>
    ))}
    <DropdownMenuSeparator />
  </div>
)}
```

(TopNav continues to use full `primary` — the desktop set. Only AppNav consumes `primaryMobile`.)

- [ ] **Step 3: Verify**

```bash
pnpm --filter @smartshaadi/web type-check
pnpm --filter @smartshaadi/web exec vitest run
```

Expected: type-check clean; all web tests pass (was 33 + 3 new = 36; the exact prior count is in the session baseline — anything ≥ previous count with the 3 new passing is green).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/AppNav.client.tsx apps/web/src/components/layout/TopNav.client.tsx
git commit -m "feat(web): cap vendor mobile tabs at 4, quick-access overflow in More"
```

---

### Task 9: `useUnreadTotal` hook (RN) — TDD

**Files:**
- Create: `apps/mobile/src/features/chat/useUnreadTotal.ts`
- Create: `apps/mobile/src/features/chat/__tests__/useUnreadTotal.test.tsx`

- [ ] **Step 1: Write the failing test** — `apps/mobile/src/features/chat/__tests__/useUnreadTotal.test.tsx` (mirror the mock/wrapper pattern of `__tests__/useConversations.test.ts`; RNTL v14 `renderHook` is async):

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { api } from '../../../lib/api';
import { useUnreadTotal } from '../useUnreadTotal';

jest.mock('../../../lib/api', () => ({
  api: {
    chat: {
      getConversations: jest.fn(),
    },
  },
  ApiRequestError: Error,
  NetworkError: Error,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUnreadTotal', () => {
  it('sums unreadCount across conversations', async () => {
    (api.chat.getConversations as jest.Mock).mockResolvedValue([
      { id: 'c1', unreadCount: 2 },
      { id: 'c2', unreadCount: 0 },
      { id: 'c3', unreadCount: 5 },
    ]);

    const { result } = await renderHook(() => useUnreadTotal(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).toBe(7));
    expect(api.chat.getConversations).toHaveBeenCalledWith('all');
  });

  it('returns 0 while loading and 0 on error', async () => {
    (api.chat.getConversations as jest.Mock).mockRejectedValue(new Error('network down'));

    const { result } = await renderHook(() => useUnreadTotal(), { wrapper: createWrapper() });

    expect(result.current).toBe(0);
    await waitFor(() => expect(api.chat.getConversations).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @smartshaadi/mobile exec jest src/features/chat/__tests__/useUnreadTotal.test.tsx
```

Expected: FAIL — cannot find module `../useUnreadTotal`.

- [ ] **Step 3: Implement** — `apps/mobile/src/features/chat/useUnreadTotal.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ConversationListItem } from '@smartshaadi/types';

/**
 * Total unread messages across conversations — drives the Chat tab badge.
 * Cheap polling cadence; the badge is a hint, not a realtime counter, and the
 * chat screens keep their own live socket state.
 */
export function useUnreadTotal(): number {
  const { data } = useQuery<ConversationListItem[]>({
    queryKey: ['chat', 'unread-total'],
    queryFn: () => api.chat.getConversations('all'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  return (data ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}
```

- [ ] **Step 4: Run tests — expect 2 passing.** Same command as Step 2.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/chat/useUnreadTotal.ts apps/mobile/src/features/chat/__tests__/useUnreadTotal.test.tsx
git commit -m "feat(mobile): useUnreadTotal hook for chat tab badge"
```

---

### Task 10: Chat unread badge on the FloatingTabBar — TDD

**Files:**
- Modify: `apps/mobile/src/components/__tests__/FloatingTabBar.test.tsx`
- Modify: `apps/mobile/src/components/FloatingTabBar.tsx`

**Pre-check:** confirm the tab bar renders under the app's `QueryClientProvider` — inspect `apps/mobile/src/app/_layout.tsx` for the provider wrapping the router tree. It must, since feature screens already use `useQuery`. If it somehow doesn't, wrap there first (it is the root provider fix, one line).

- [ ] **Step 1: Extend the test file.** Add the hook mock at the top (after existing imports) and new tests:

```tsx
import { useUnreadTotal } from '../../features/chat/useUnreadTotal';

jest.mock('../../features/chat/useUnreadTotal', () => ({
  useUnreadTotal: jest.fn(() => 0),
}));
```

New test cases inside the existing `describe`:

```tsx
  it('shows the unread badge on the Chat tab when there are unread messages', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(3);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    const badge = screen.getByTestId('chat-unread-badge');
    expect(badge).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('caps the badge label at 99+', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(140);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('hides the badge when there are no unreads', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(0);
    await render(<FloatingTabBar {...makeProps({ index: 0 })} />);

    expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
  });

  it('hides the badge while the Chat tab is focused', async () => {
    (useUnreadTotal as jest.Mock).mockReturnValue(3);
    await render(<FloatingTabBar {...makeProps({ index: 1 })} />); // (chat) is index 1

    expect(screen.queryByTestId('chat-unread-badge')).toBeNull();
  });
```

- [ ] **Step 2: Run to verify the 4 new tests fail** (existing 2 must still pass)

```bash
pnpm --filter @smartshaadi/mobile exec jest src/components/__tests__/FloatingTabBar.test.tsx
```

Expected: 2 pass, 4 fail (no `chat-unread-badge` testID).

- [ ] **Step 3: Implement in `FloatingTabBar.tsx`.** Imports: add `Text` to the react-native import and:

```tsx
import { useUnreadTotal } from '@/features/chat/useUnreadTotal';
```

Inside the component body (top, with the other hooks):

```tsx
const unreadTotal = useUnreadTotal();
```

In the tab render, inside the `Animated.View` pill (right after the `<IconComponent …/>` element), add:

```tsx
{route.name === '(chat)' && !isFocused && unreadTotal > 0 ? (
  <View
    testID="chat-unread-badge"
    pointerEvents="none"
    className="absolute right-1 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-primary px-1"
  >
    <Text className="text-[10px] font-bold text-on-primary">
      {unreadTotal > 99 ? '99+' : String(unreadTotal)}
    </Text>
  </View>
) : null}
```

(RN `Text` — NOT `Animated.Text` — plain is fine here; `absolute` works because the pill `Animated.View` is the positioned parent.)

- [ ] **Step 4: Run tests — expect 6 passing.** Same command as Step 2.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/FloatingTabBar.tsx apps/mobile/src/components/__tests__/FloatingTabBar.test.tsx
git commit -m "feat(mobile): chat unread badge on floating tab bar"
```

---

### Task 11: No-nav-stranding audit (RN utility screens)

**Files:**
- Possibly modify: screens under `apps/mobile/src/app/(app)/` that hide the tab bar but lack a back affordance

- [ ] **Step 1: List utility screens missing AppHeader**

```bash
cd apps/mobile && grep -L 'AppHeader' src/app/\(app\)/*.tsx src/app/\(app\)/booking/*.tsx | grep -v _layout
```

- [ ] **Step 2: For each hit, open the file and check how it renders its title/back.** A screen is FINE if it uses `AppHeader` with `showBack`, or is modal-style with its own close affordance (`biometric-unlock` is a gate screen — exempt). A screen FAILS the audit if it renders a bare title with no back control. Fix pattern (match existing usage in the codebase):

```tsx
import { AppHeader } from '@/components/AppHeader';
// at the top of the screen's JSX, inside its Screen/SafeArea wrapper:
<AppHeader title="Settings" showBack />
```

Keep each screen's existing title text; add `showBack` only — no other changes in this task (screen polish is Phase 2).

- [ ] **Step 3: Run the mobile suite**

```bash
pnpm --filter @smartshaadi/mobile exec jest
```

Expected: all suites pass (baseline 215 + 6 new from Tasks 9–10 = 221; a small delta from Step 2 fixes is fine as long as everything passes).

- [ ] **Step 4: Commit** (only if Step 2 changed files)

```bash
git add apps/mobile/src/app/\(app\)/<changed files only>
git commit -m "fix(mobile): back affordance on utility screens that hide the tab bar"
```

---

### Task 12: Regression gate

**Files:** none

- [ ] **Step 1:**

```bash
pnpm exec turbo type-check --force
```

Expected: 13/13 successful (cold, no cache).

- [ ] **Step 2:**

```bash
pnpm --filter @smartshaadi/web exec vitest run
pnpm --filter @smartshaadi/mobile exec jest
```

Expected: web ≥ 36 passing / 0 failing; mobile 221 passing / 0 failing. (api/ai-service untouched by this plan — skip unless something above touched them.)

- [ ] **Step 3: Record results** for the close-out report; any failure = stop and fix before Task 13.

---

### Task 13: Logged-in browser QA (blocks on operator sudo)

**Files:** none (evidence; findings become fixes only with user approval)

- [ ] **Step 1: Ask the operator to start PG + Redis** (non-systemd WSL — needs their sudo), then confirm `curl -s http://localhost:4000/health` shows postgres+redis ok.
- [ ] **Step 2: VENDOR pass** — log in as `+917000000201` (OTP 123456) via the web login UI:
  - 375×812: bottom bar shows exactly Home / Bookings / Orders / Profile / More (5 columns, roomy); More sheet opens with **Quick access** group first containing Products, Payouts, Links; tapping Products navigates and lights the More tab as active.
  - 768×900 (tablet): TopNav shows 4 items + More; no wrap/overflow; More dropdown contains Quick access group.
  - 1440×900: TopNav shows all 7 items + More; no Quick access group visible in the dropdown (lg:hidden).
- [ ] **Step 3: INDIVIDUAL pass** — `+917000000003`: bottom bar unchanged (Discover/Chats/Wedding/Profile/More), More sheet has NO Quick access group; desktop TopNav unchanged.
- [ ] **Step 4: Console clean everywhere; screenshot evidence to scratchpad.** Report PASS/FAIL per check — do not fix silently.

---

## Self-review (done at plan-writing time)

- **Spec coverage:** 1a→Tasks 1–4, 1b→Task 5, 1c→Tasks 7–8, 1d→Tasks 9–11; verification→Tasks 6, 12, 13. Spec's "align More-dropdown paddings with marketing panels" is covered by Task 8 reusing the same `rounded-xl/gold` row treatment; spec's "centralise tab labels" resolved as already-centralised (`TABS` const) — no change needed.
- **Placeholder scan:** none; every code step carries full code.
- **Type consistency:** `splitPrimary(primary, primaryMobile) → {mobile, overflow}` used identically in Task 7 test, Task 7 impl, Task 8 wiring; `useUnreadTotal(): number` consistent across Tasks 9–10; `MarketingMenuItem`/`MarketingNavLink` consistent across Tasks 3–5.
- **Known risks called out in-task:** SEO URL pattern verification (Task 3), `vendors` label key nesting (Tasks 3–5), fragment-merge-only rule (Task 2), QueryClientProvider pre-check (Task 10), `text-muted-foreground` trap (Task 4).
