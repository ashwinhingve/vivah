import Link from 'next/link';
import { Heart, MailOpen, Calendar, UserCog, ArrowRight, Bookmark, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Action = { href: string; label: string; desc: string; icon: LucideIcon };

const ACTIONS: readonly Action[] = [
  { href: '/feed',           label: 'Discover Matches', desc: 'Browse compatible profiles', icon: Heart },
  { href: '/requests',       label: 'Match Requests',   desc: 'Review incoming requests',   icon: MailOpen },
  { href: '/shortlist',      label: 'My Shortlist',     desc: 'Profiles you saved',         icon: Bookmark },
  { href: '/viewers',        label: 'Viewed You',       desc: 'See who visited recently',   icon: Eye },
  { href: '/bookings',       label: 'My Bookings',      desc: 'Wedding vendor bookings',    icon: Calendar },
  { href: '/profile/create', label: 'Edit Profile',     desc: 'Update your profile',        icon: UserCog },
] as const;

export function QuickActions() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <h2 className="mb-4 font-heading text-base font-semibold text-primary">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ href, label, desc, icon: Icon }) => (
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
        ))}
      </div>
    </div>
  );
}
