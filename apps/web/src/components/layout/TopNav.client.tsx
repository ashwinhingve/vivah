'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Calendar, Heart, MessageCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV_ITEMS: { href: string; key: 'matches' | 'chat' | 'wedding' | 'profile'; icon: LucideIcon }[] = [
  { href: '/feed',      key: 'matches', icon: Heart },
  { href: '/chats',     key: 'chat',    icon: MessageCircle },
  { href: '/weddings',  key: 'wedding', icon: Calendar },
  { href: '/dashboard', key: 'profile', icon: User },
];

/**
 * Desktop horizontal nav bar. Renders only on `md:flex+`. Mobile nav is the
 * existing `<AppNav>` drawer.
 */
export function TopNav() {
  const t = useTranslations('nav.top');
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Primary"
      className="hidden items-center gap-1 md:flex"
    >
      {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
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
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
