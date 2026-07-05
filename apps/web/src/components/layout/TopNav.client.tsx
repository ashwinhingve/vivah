'use client';

import { Link } from '@/i18n/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { navForRole, filterForDemo } from './nav-config';

/**
 * Desktop horizontal nav bar. Renders only on `md:flex+`. Mobile nav is the
 * `<AppNav>` bottom bar. Role-aware: shares the same per-role nav set as AppNav
 * via `navForRole`, so every role sees its own links (not the INDIVIDUAL set).
 */
export function TopNav() {
  const t = useTranslations('nav.app');
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? 'INDIVIDUAL';

  const { primary, moreGroups } = navForRole(role);
  const items = filterForDemo(primary);
  const groups = moreGroups
    .map((group) => ({ ...group, items: filterForDemo(group.items) }))
    .filter((group) => group.items.length > 0);

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

      {groups.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-fg-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-surface-muted"
            aria-label={t('moreLabel')}
          >
            {t('more')}
            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-[15rem]">
            {groups.map((group, gi) => (
              <div key={group.titleKey}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(group.titleKey)}
                </DropdownMenuLabel>
                {group.items.map(({ href, labelKey, Icon }) => (
                  <DropdownMenuItem
                    key={href}
                    onSelect={() => router.push(href)}
                    className="flex cursor-pointer items-center gap-2.5"
                  >
                    <Icon strokeWidth={1.75} className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {t(labelKey)}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
