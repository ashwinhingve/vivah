'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Home, Search, Calendar, Bell, User } from 'lucide-react';

type NavItem = { href: string; label: string; Icon: React.ComponentType<{ className?: string }> };

const INDIVIDUAL_NAV: NavItem[] = [
  { href: '/feed',      label: 'Matches',   Icon: Home },
  { href: '/vendors',   label: 'Vendors',   Icon: Search },
  { href: '/bookings',  label: 'Bookings',  Icon: Calendar },
  { href: '/requests',  label: 'Requests',  Icon: Bell },
  { href: '/dashboard', label: 'Dashboard', Icon: User },
];

const VENDOR_NAV: NavItem[] = [
  { href: '/vendor-dashboard', label: 'Dashboard', Icon: Home },
  { href: '/bookings',         label: 'Bookings',  Icon: Calendar },
  { href: '/vendors',          label: 'Browse',    Icon: Search },
  { href: '/profile/personal', label: 'Profile',   Icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin',     label: 'Admin',    Icon: Home },
  { href: '/vendors',   label: 'Vendors',  Icon: Search },
  { href: '/bookings',  label: 'Bookings', Icon: Calendar },
  { href: '/dashboard', label: 'Dashboard', Icon: User },
];

export function AppNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  const items =
    role === 'VENDOR' ? VENDOR_NAV :
    (role === 'ADMIN' || role === 'SUPPORT') ? ADMIN_NAV :
    INDIVIDUAL_NAV;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#C5A47E]/20 shadow-2xl">
      <div className="mx-auto max-w-lg flex items-stretch">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] gap-0.5 transition-colors relative ${
                active ? 'text-[#0E7C7B]' : 'text-[#6B6B76] hover:text-[#2E2E38]'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? '[stroke-width:2.5]' : '[stroke-width:1.5]'}`} />
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#0E7C7B]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
