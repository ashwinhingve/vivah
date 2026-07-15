import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Heart, MailOpen, Calendar, UserCog, ArrowRight, Bookmark, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ActionKey =
  | 'discoverMatches'
  | 'matchRequests'
  | 'myShortlist'
  | 'viewedYou'
  | 'myBookings'
  | 'editProfile';

const ACTIONS: readonly { href: string; key: ActionKey; icon: LucideIcon }[] = [
  { href: '/feed',             key: 'discoverMatches', icon: Heart },
  { href: '/requests',         key: 'matchRequests',   icon: MailOpen },
  { href: '/shortlist',        key: 'myShortlist',     icon: Bookmark },
  { href: '/viewers',          key: 'viewedYou',       icon: Eye },
  { href: '/bookings',         key: 'myBookings',      icon: Calendar },
  { href: '/profile/personal', key: 'editProfile',     icon: UserCog },
] as const;

export async function QuickActions() {
  const t = await getTranslations('dashboard.quickActions');
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-5 shadow-card">
      <h2 className="mb-4 font-heading text-base font-semibold text-primary">{t('title')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ href, key, icon: Icon }) => {
          const label = t(key);
          const desc = t(`${key}Desc` as 'discoverMatchesDesc');
          return (
            <Link
              key={href}
              href={href}
              className="group relative flex min-h-[72px] flex-col justify-center gap-0.5 rounded-lg border border-border bg-gradient-to-br from-surface to-surface-muted/50 p-3 pr-10 transition-all duration-150 hover:-translate-y-0.5 hover:border-teal hover:bg-teal/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-primary transition-colors group-hover:text-teal">
                {label}
              </p>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <ArrowRight
                className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 text-teal/50 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
