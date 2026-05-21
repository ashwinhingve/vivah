'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Home,
  Search,
  Calendar,
  User,
  Cake,
  Package,
  ShoppingBag,
  ShoppingCart,
  MoreHorizontal,
  X,
  Bookmark,
  Eye,
  EyeOff,
  Shield,
  Heart,
  MessageCircle,
  Sparkles,
  Bell,
  Wallet,
  FileText,
  Receipt,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type NavItem = { href: string; labelKey: string; Icon: LucideIcon };
type NavGroup = { titleKey: string; items: NavItem[] };

const INDIVIDUAL_PRIMARY: NavItem[] = [
  { href: '/feed',      labelKey: 'discover',     Icon: Home },
  { href: '/requests',  labelKey: 'requests',     Icon: Heart },
  { href: '/matches',   labelKey: 'connections',  Icon: Sparkles },
  { href: '/weddings',  labelKey: 'wedding',      Icon: Cake },
  { href: '/dashboard', labelKey: 'profile',      Icon: User },
];

const INDIVIDUAL_MORE_GROUPS: NavGroup[] = [
  {
    titleKey: 'groupSocial',
    items: [
      { href: '/chats',         labelKey: 'chats',         Icon: MessageCircle },
      { href: '/notifications', labelKey: 'notifications', Icon: Bell },
      { href: '/likes',         labelKey: 'likes',         Icon: Heart },
      { href: '/shortlist',     labelKey: 'shortlist',     Icon: Bookmark },
      { href: '/viewers',       labelKey: 'viewedMe',      Icon: Eye },
    ],
  },
  {
    titleKey: 'groupDiscover',
    items: [
      { href: '/vendors', labelKey: 'vendors', Icon: Search },
    ],
  },
  {
    titleKey: 'groupShop',
    items: [
      { href: '/store',    labelKey: 'shop',     Icon: ShoppingBag },
      { href: '/rentals',  labelKey: 'rentals',  Icon: Package },
      { href: '/bookings', labelKey: 'bookings', Icon: Calendar },
    ],
  },
  {
    titleKey: 'groupMoney',
    items: [
      { href: '/payments',          labelKey: 'payments', Icon: ShoppingCart },
      { href: '/payments/wallet',   labelKey: 'wallet',   Icon: Wallet },
      { href: '/payments/invoices', labelKey: 'invoices', Icon: FileText },
      { href: '/payments/refunds',  labelKey: 'refunds',  Icon: Receipt },
    ],
  },
  {
    titleKey: 'groupSettings',
    items: [
      { href: '/profile/personal',             labelKey: 'editProfile', Icon: UserCog },
      { href: '/settings/privacy',             labelKey: 'privacy',     Icon: EyeOff },
      { href: '/settings/security/two-factor', labelKey: 'security',    Icon: Shield },
    ],
  },
];

const INDIVIDUAL_MORE: NavItem[] = INDIVIDUAL_MORE_GROUPS.flatMap((g) => g.items);

// Demo-mode route blocklist — hidden when NEXT_PUBLIC_DEMO_MODE === 'true'.
// Prefix-match: any href starting with one of these is filtered out.
const DEMO_HIDDEN_PREFIXES = [
  '/store',
  '/rentals',
  '/admin',
  '/vendor-dashboard',
] as const;

function isDemoMode(): boolean {
  return process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true';
}

function filterForDemo<T extends { href: string }>(items: T[]): T[] {
  if (!isDemoMode()) return items;
  return items.filter(
    (i) => !DEMO_HIDDEN_PREFIXES.some((p) => i.href === p || i.href.startsWith(`${p}/`)),
  );
}

const VENDOR_NAV: NavItem[] = [
  { href: '/vendor-dashboard',        labelKey: 'home',     Icon: Home },
  { href: '/bookings',                labelKey: 'bookings', Icon: Calendar },
  { href: '/vendor-dashboard/store',  labelKey: 'products', Icon: Package },
  { href: '/vendor-dashboard/orders', labelKey: 'orders',   Icon: ShoppingCart },
  { href: '/vendor/payouts',          labelKey: 'payouts',  Icon: ShoppingBag },
  { href: '/payments/links',          labelKey: 'links',    Icon: MessageCircle },
  { href: '/profile/personal',        labelKey: 'profile',  Icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',           labelKey: 'admin',    Icon: Home },
  { href: '/admin/revenue',   labelKey: 'revenue',  Icon: Search },
  { href: '/admin/payouts',   labelKey: 'payouts',  Icon: ShoppingBag },
  { href: '/admin/refunds',   labelKey: 'refunds',  Icon: Shield },
  { href: '/admin/promos',    labelKey: 'promos',   Icon: Heart },
  { href: '/admin/escrow',    labelKey: 'disputes', Icon: Bookmark },
  { href: '/vendors',         labelKey: 'vendors',  Icon: Search },
  { href: '/bookings',        labelKey: 'bookings', Icon: Calendar },
];

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== '/dashboard' && href !== '/' && pathname.startsWith(href))
  );
}

export function AppNav() {
  const t = useTranslations('nav.app');
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const reduce = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const showMore = role === 'INDIVIDUAL';
  const primaryRaw = showMore
    ? INDIVIDUAL_PRIMARY
    : role === 'VENDOR'
      ? VENDOR_NAV
      : (role === 'ADMIN' || role === 'SUPPORT')
        ? ADMIN_NAV
        : INDIVIDUAL_PRIMARY;
  const primary = filterForDemo(primaryRaw);
  const moreItems = showMore ? filterForDemo(INDIVIDUAL_MORE) : [];
  const moreActive = showMore && moreItems.some(i => isActive(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-surface/85 shadow-[0_-4px_20px_-8px_rgba(123,45,66,0.08)] backdrop-blur-xl"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        />
        <div className="mx-auto flex max-w-lg items-stretch">
          {primary.map(({ href, labelKey, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                  active ? 'text-teal' : 'text-muted-foreground hover:text-primary'
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="app-nav-pill"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 32 }
                    }
                    className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    active ? 'scale-110' : 'scale-100 group-hover:scale-105'
                  )}
                  strokeWidth={active ? 2.5 : 1.75}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-[10px] leading-none',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {t(labelKey)}
                </span>
              </Link>
            );
          })}
          {showMore ? (
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label={t('moreLabel')}
              className={cn(
                'group relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
                moreActive || moreOpen ? 'text-teal' : 'text-muted-foreground hover:text-primary'
              )}
            >
              {moreActive && !moreOpen ? (
                <motion.span
                  layoutId="app-nav-pill"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 32 }
                  }
                  className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20"
                  aria-hidden="true"
                />
              ) : null}
              {moreOpen ? (
                <X
                  className="h-5 w-5 scale-110 transition-transform"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              ) : (
                <MoreHorizontal
                  className={cn(
                    'h-5 w-5 transition-transform',
                    'scale-100 group-hover:scale-105'
                  )}
                  strokeWidth={moreActive ? 2.5 : 1.75}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  'text-[10px] leading-none',
                  moreActive || moreOpen ? 'font-semibold' : 'font-medium'
                )}
              >
                {t('more')}
              </span>
            </button>
          ) : null}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {showMore ? (
        <AnimatePresence>
          {moreOpen ? (
            <>
              <motion.div
                key="more-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                onClick={() => setMoreOpen(false)}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                aria-hidden="true"
              />
              <motion.div
                key="more-sheet"
                role="menu"
                aria-label="More navigation"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 360, damping: 34 }
                }
                className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-gold/25 bg-surface shadow-2xl"
              >
                <div className="mx-auto max-w-lg">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMoreOpen(false)}
                      aria-label="Close menu"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-gold/10 hover:text-primary transition-colors"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="px-5 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gold-muted" aria-hidden="true">
                      {t('more')}
                    </p>
                    <h2 className="font-heading text-lg font-semibold text-primary">
                      {t('everythingElse')}
                    </h2>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                    {INDIVIDUAL_MORE_GROUPS.map((group) => (
                      <section key={group.titleKey} className="mt-2 first:mt-0">
                        <h3 className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {t(group.titleKey)}
                        </h3>
                        <ul>
                          {group.items.map(({ href, labelKey, Icon }) => {
                            const active = isActive(pathname, href);
                            return (
                              <li key={href}>
                                <Link
                                  href={href}
                                  role="menuitem"
                                  aria-current={active ? 'page' : undefined}
                                  className={cn(
                                    'flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-3 transition-colors',
                                    active
                                      ? 'bg-teal/10 text-teal'
                                      : 'text-foreground hover:bg-gold/10'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex h-10 w-10 items-center justify-center rounded-lg',
                                      active ? 'bg-teal/15 text-teal' : 'bg-gold/10 text-primary'
                                    )}
                                    aria-hidden="true"
                                  >
                                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                                  </span>
                                  <span className="text-sm font-medium">{t(labelKey)}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      ) : null}
    </>
  );
}
