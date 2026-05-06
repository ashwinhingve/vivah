'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Heart, MessageCircle, User } from 'lucide-react';

const NAV = [
  { href: '/feed', label: 'Matches', icon: Heart },
  { href: '/chats', label: 'Chat', icon: MessageCircle },
  { href: '/weddings', label: 'Wedding', icon: Calendar },
  { href: '/dashboard', label: 'Profile', icon: User },
] as const;

/**
 * Desktop horizontal nav bar. Renders only on `md:flex+`. Mobile nav is the
 * existing `<AppNav>` drawer.
 */
export function TopNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Primary"
      className="hidden items-center gap-1 md:flex"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-fg-1 hover:bg-surface-muted'
            }`}
          >
            <Icon strokeWidth={1.75} className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
