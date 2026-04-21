'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, Search, Calendar, User, Cake } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; Icon: LucideIcon };

const INDIVIDUAL_NAV: NavItem[] = [
  { href: '/feed',      label: 'Matches',   Icon: Home },
  { href: '/vendors',   label: 'Vendors',   Icon: Search },
  { href: '/weddings',  label: 'My Wedding', Icon: Cake },
  { href: '/bookings',  label: 'Bookings',  Icon: Calendar },
  { href: '/dashboard', label: 'Profile',   Icon: User },
];

const VENDOR_NAV: NavItem[] = [
  { href: '/vendor-dashboard', label: 'Dashboard', Icon: Home },
  { href: '/bookings',         label: 'Bookings',  Icon: Calendar },
  { href: '/vendors',          label: 'Browse',    Icon: Search },
  { href: '/profile/personal', label: 'Profile',   Icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',     label: 'Admin',     Icon: Home },
  { href: '/vendors',   label: 'Vendors',   Icon: Search },
  { href: '/bookings',  label: 'Bookings',  Icon: Calendar },
  { href: '/dashboard', label: 'Dashboard', Icon: User },
];

export function AppNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const reduce = useReducedMotion();
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  const items =
    role === 'VENDOR' ? VENDOR_NAV :
    (role === 'ADMIN' || role === 'SUPPORT') ? ADMIN_NAV :
    INDIVIDUAL_NAV;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/25 bg-surface/85 shadow-[0_-4px_20px_-8px_rgba(123,45,66,0.08)] backdrop-blur-xl"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== '/dashboard' && href !== '/' && pathname.startsWith(href));
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
                  className="absolute inset-x-3 top-1 bottom-1 -z-10 rounded-xl bg-teal/10 ring-1 ring-inset ring-teal/20"
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
      </div>
      {/* Safe-area spacer for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
