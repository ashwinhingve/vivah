import { type ComponentType, type ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import {
  HeartHandshake,
  MessageCircle,
  CalendarClock,
  Store,
  Sparkles,
  ListChecks,
  SearchX,
  Bell,
  Bookmark,
  WifiOff,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NoMatchesIllustration,
  NoMessagesIllustration,
  NoBookingsIllustration,
  NoVendorsIllustration,
  NoWeddingPlanIllustration,
  NoTasksIllustration,
  NoNotificationsIllustration,
  NoShortlistIllustration,
  NoSearchResultsIllustration,
  NoNetworkIllustration,
} from './illustrations';

type EmptyVariant =
  | 'no-matches'
  | 'no-messages'
  | 'no-bookings'
  | 'no-vendors'
  | 'no-wedding'
  | 'no-tasks'
  | 'no-results'
  | 'no-notifications'
  | 'no-shortlist'
  | 'no-search-results'
  | 'no-network';

type IllustrationComponent = ComponentType<{ className?: string }>;

const PRESETS: Record<
  EmptyVariant,
  {
    illustration: IllustrationComponent;
    icon: ComponentType<LucideProps>;
    title: string;
    description: string;
  }
> = {
  'no-matches': {
    illustration: NoMatchesIllustration,
    icon: HeartHandshake,
    title: 'Your match is out there',
    description: 'Complete your profile to start seeing curated, mutually-interested matches.',
  },
  'no-messages': {
    illustration: NoMessagesIllustration,
    icon: MessageCircle,
    title: 'No conversations yet',
    description: 'When you and a match connect, your chats will appear here.',
  },
  'no-bookings': {
    illustration: NoBookingsIllustration,
    icon: CalendarClock,
    title: 'No bookings yet',
    description: 'Discover trusted vendors and your confirmed bookings will show up here.',
  },
  'no-vendors': {
    illustration: NoVendorsIllustration,
    icon: Store,
    title: 'No vendors found',
    description: 'Try widening your filters or exploring a nearby city.',
  },
  'no-wedding': {
    illustration: NoWeddingPlanIllustration,
    icon: Sparkles,
    title: 'Begin your wedding plan',
    description: 'Create a plan to organise ceremonies, budget, guests and vendors in one place.',
  },
  'no-tasks': {
    illustration: NoTasksIllustration,
    icon: ListChecks,
    title: 'All caught up',
    description: 'No pending tasks right now. New ones will appear as your plan progresses.',
  },
  'no-results': {
    illustration: NoMatchesIllustration,
    icon: SearchX,
    title: 'No results',
    description: 'Nothing matched your search. Try different terms or adjust your filters.',
  },
  'no-notifications': {
    illustration: NoNotificationsIllustration,
    icon: Bell,
    title: 'You’re all caught up',
    description: 'No new notifications right now. We’ll let you know when something happens.',
  },
  'no-shortlist': {
    illustration: NoShortlistIllustration,
    icon: Bookmark,
    title: 'Your shortlist is empty',
    description: 'Save profiles you’d like to revisit and they’ll appear here.',
  },
  'no-search-results': {
    illustration: NoSearchResultsIllustration,
    icon: SearchX,
    title: 'No results',
    description: 'Try different terms or adjust your filters.',
  },
  'no-network': {
    illustration: NoNetworkIllustration,
    icon: WifiOff,
    title: 'Couldn’t load this page',
    description: 'Check your connection and try again.',
  },
};

interface EmptyStateProps {
  variant?: EmptyVariant;
  /** Custom warm SVG illustration. Falls back to the variant preset. */
  illustration?: IllustrationComponent;
  /** Legacy lucide icon path — used only when no illustration is available. */
  icon?: ComponentType<LucideProps>;
  title?: string;
  description?: string;
  /** Server-safe CTA: renders a styled Link. */
  actionLabel?: string;
  actionHref?: string;
  /** Or pass a custom (interactive) CTA node — takes priority over actionHref. */
  action?: ReactNode;
  className?: string;
}

/**
 * Designed empty state — never a blank screen. Custom warm SVG illustration
 * (gold/burgundy/ivory), Playfair heading, muted subtext, optional CTA.
 * Server component. Back-compat: pass `icon` to fall back to a lucide glyph.
 */
export function EmptyState({
  variant = 'no-matches',
  illustration,
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  action,
  className,
}: EmptyStateProps) {
  const preset = PRESETS[variant];
  const Illustration = illustration ?? (icon ? null : preset.illustration);
  const Icon = icon ?? (illustration ? null : preset.icon);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      {Illustration ? (
        <Illustration className="mb-5 h-28 w-28" />
      ) : Icon ? (
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gold/15">
          <Icon className="h-16 w-16 text-gold-muted" strokeWidth={1.25} aria-hidden="true" />
        </div>
      ) : null}

      <h3 className="font-heading text-xl font-semibold text-primary">
        {title ?? preset.title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-text-muted">
        {description ?? preset.description}
      </p>

      {action ? (
        <div className="mt-6">{action}</div>
      ) : actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-teal px-5 text-sm font-semibold text-white shadow-sm transition-all duration-100 ease-out hover:-translate-y-px hover:bg-teal-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
