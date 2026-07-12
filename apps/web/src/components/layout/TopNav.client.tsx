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
import { cn } from '@/lib/utils';
import { navForRole, filterForDemo, activeNavHref } from './nav-config';

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
  const groupItems = groups.flatMap((group) => group.items);

  // Most specific matching href across the whole nav set wins — same logic and
  // same teal active treatment as the mobile <AppNav>.
  const currentHref = activeNavHref(
    pathname,
    [...items, ...groupItems].map((i) => i.href),
  );
  const moreActive = groupItems.some((i) => i.href === currentHref);

  return (
    <nav
      aria-label={t('primaryNav')}
      className="hidden items-center gap-1 md:flex"
    >
      {items.map(({ href, labelKey, Icon }) => {
        const isActive = href === currentHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-teal/10 text-teal'
                : 'text-fg-1 hover:bg-surface-muted',
            )}
          >
            <Icon strokeWidth={1.75} className="h-4 w-4" aria-hidden />
            {t(labelKey)}
          </Link>
        );
      })}

      {groups.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-surface-muted',
              moreActive ? 'bg-teal/10 text-teal' : 'text-fg-1',
            )}
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
                {group.items.map(({ href, labelKey, Icon }) => {
                  const isActive = href === currentHref;
                  return (
                    <DropdownMenuItem
                      key={href}
                      onSelect={() => router.push(href)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5',
                        isActive && 'bg-teal/10 text-teal focus:bg-teal/15 focus:text-teal',
                      )}
                    >
                      <Icon
                        strokeWidth={1.75}
                        className={cn('h-4 w-4', isActive ? 'text-teal' : 'text-muted-foreground')}
                        aria-hidden
                      />
                      {t(labelKey)}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
