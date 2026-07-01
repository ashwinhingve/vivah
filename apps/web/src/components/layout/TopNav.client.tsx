'use client';

import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { navForRole, filterForDemo } from './nav-config';

/**
 * Desktop horizontal nav bar. Renders only on `md:flex+`. Mobile nav is the
 * `<AppNav>` bottom bar. Role-aware: shares the same per-role nav set as AppNav
 * via `navForRole`, so every role sees its own links (not the INDIVIDUAL set).
 */
export function TopNav() {
  const t = useTranslations('nav.app');
  const pathname = usePathname() ?? '';
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  const items = filterForDemo(navForRole(role).primary);

  return (
    <nav
      aria-label="Primary"
      className="hidden items-center gap-1 md:flex"
    >
      {items.map(({ href, labelKey, Icon }) => {
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
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
