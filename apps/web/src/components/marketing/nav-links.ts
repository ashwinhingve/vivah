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
  labelKey: string; // under marketing.navbar.menu (except 'vendors': top-level)
  descKey: string; // under marketing.navbar.menu
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
  { labelKey: 'vendors',    descKey: 'vendorsDesc', href: '/vendors', Icon: Store },
  { labelKey: 'helpCentre', descKey: 'helpDesc',    href: '/help',    Icon: LifeBuoy },
  { labelKey: 'aboutUs',    descKey: 'aboutDesc',   href: '/about',   Icon: Info },
];

// SEO landing pages. URL patterns verified against (public)/[slug]/page.tsx:
// `/${community}-matrimony` and `/marriages-in-${city}` (src/lib/seo-data.ts
// slugs; dynamicParams=false — anything else 404s). Labels under
// marketing.navbar.menu.popular.
export const POPULAR_SEARCHES: MarketingNavLink[] = [
  { labelKey: 'hindu',     href: '/hindu-matrimony' },
  { labelKey: 'sikh',      href: '/sikh-matrimony' },
  { labelKey: 'delhi',     href: '/marriages-in-delhi' },
  { labelKey: 'mumbai',    href: '/marriages-in-mumbai' },
  { labelKey: 'bangalore', href: '/marriages-in-bangalore' },
  { labelKey: 'jaipur',    href: '/marriages-in-jaipur' },
];
