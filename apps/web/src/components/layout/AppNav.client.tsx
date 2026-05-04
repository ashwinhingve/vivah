'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Shield,
  Heart,
  MessageCircle,
  Sparkles,
  Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; Icon: LucideIcon };

const INDIVIDUAL_PRIMARY: NavItem[] = [
  { href: '/feed',      label: 'Discover',    Icon: Home },
  { href: '/requests',  label: 'Requests',    Icon: Heart },
  { href: '/matches',   label: 'Connections', Icon: Sparkles },
  { href: '/weddings',  label: 'Wedding',     Icon: Cake },
  { href: '/dashboard', label: 'Profile',     Icon: User },
];

const INDIVIDUAL_MORE: NavItem[] = [
  { href: '/chats',                       label: 'Chats',         Icon: MessageCircle },
  { href: '/notifications',               label: 'Notifications', Icon: Bell },
  { href: '/vendors',                     label: 'Vendors',       Icon: Search },
  { href: '/likes',                       label: 'Likes',         Icon: Heart },
  { href: '/shortlist',                   label: 'Shortlist',     Icon: Bookmark },
  { href: '/viewers',                     label: 'Viewed Me',     Icon: Eye },
  { href: '/settings/privacy',            label: 'Privacy',       Icon: Shield },
  { href: '/settings/security/two-factor',label: 'Security',      Icon: Shield },
  { href: '/store',                       label: 'Shop',          Icon: ShoppingBag },
  { href: '/rentals',                     label: 'Rentals',       Icon: Package },
  { href: '/bookings',                    label: 'Bookings',      Icon: Calendar },
  { href: '/payments',                    label: 'Payments',      Icon: ShoppingCart },
  { href: '/payments/wallet',             label: 'Wallet',        Icon: Package },
  { href: '/payments/invoices',           label: 'Invoices',      Icon: Bookmark },
  { href: '/payments/refunds',            label: 'Refunds',       Icon: Shield },
];

const VENDOR_NAV: NavItem[] = [
  { href: '/vendor-dashboard',        label: 'Home',     Icon: Home },
  { href: '/bookings',                label: 'Bookings', Icon: Calendar },
  { href: '/vendor-dashboard/store',  label: 'Products', Icon: Package },
  { href: '/vendor-dashboard/orders', label: 'Orders',   Icon: ShoppingCart },
  { href: '/vendor/payouts',          label: 'Payouts',  Icon: ShoppingBag },
  { href: '/payments/links',          label: 'Links',    Icon: MessageCircle },
  { href: '/profile/personal',        label: 'Profile',  Icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',           label: 'Admin',    Icon: Home },
  { href: '/admin/revenue',   label: 'Revenue',  Icon: Search },
  { href: '/admin/payouts',   label: 'Payouts',  Icon: ShoppingBag },
  { href: '/admin/refunds',   label: 'Refunds',  Icon: Shield },
  { href: '/admin/promos',    label: 'Promos',   Icon: Heart },
  { href: '/admin/escrow',    label: 'Disputes', Icon: Bookmark },
  { href: '/vendors',         label: 'Vendors',  Icon: Search },
  { href: '/bookings',        label: 'Bookings', Icon: Calendar },
];

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== '/dashboard' && href !== '/' && pathname.startsWith(href))
  );
}

export function AppNav() {
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
  const primary = showMore
    ? INDIVIDUAL_PRIMARY
    : role === 'VENDOR'
      ? VENDOR_NAV
      : (role === 'ADMIN' || role === 'SUPPORT')
        ? ADMIN_NAV
        : INDIVIDUAL_PRIMARY;
  const moreItems = showMore ? INDIVIDUAL_MORE : [];
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
          {primary.map(({ href, label, Icon }) => {
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
                  {label}
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
              aria-label="More options"
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
              <MoreHorizontal
                className={cn(
                  'h-5 w-5 transition-transform',
                  moreOpen ? 'rotate-90 scale-110' : 'scale-100 group-hover:scale-105'
                )}
                strokeWidth={moreActive || moreOpen ? 2.5 : 1.75}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-[10px] leading-none',
                  moreActive || moreOpen ? 'font-semibold' : 'font-medium'
                )}
              >
                More
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
                      More
                    </p>
                    <h2 className="font-heading text-lg font-semibold text-primary">
                      Everything else
                    </h2>
                  </div>
                  <ul className="px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                    {moreItems.map(({ href, label, Icon }) => {
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
                            <span className="text-sm font-medium">{label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      ) : null}
    </>
  );
}
