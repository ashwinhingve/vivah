import { type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import {
  HeartHandshake,
  MessageCircle,
  CalendarClock,
  Store,
  Sparkles,
  ListChecks,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyVariant =
  | 'no-matches'
  | 'no-messages'
  | 'no-bookings'
  | 'no-vendors'
  | 'no-wedding'
  | 'no-tasks';

const PRESETS: Record<
  EmptyVariant,
  { icon: ComponentType<LucideProps>; title: string; description: string }
> = {
  'no-matches': {
    icon: HeartHandshake,
    title: 'Your match is out there',
    description: 'Complete your profile to start seeing curated, mutually-interested matches.',
  },
  'no-messages': {
    icon: MessageCircle,
    title: 'No conversations yet',
    description: 'When you and a match connect, your chats will appear here.',
  },
  'no-bookings': {
    icon: CalendarClock,
    title: 'No bookings yet',
    description: 'Discover trusted vendors and your confirmed bookings will show up here.',
  },
  'no-vendors': {
    icon: Store,
    title: 'No vendors found',
    description: 'Try widening your filters or exploring a nearby city.',
  },
  'no-wedding': {
    icon: Sparkles,
    title: 'Begin your wedding plan',
    description: 'Create a plan to organise ceremonies, budget, guests and vendors in one place.',
  },
  'no-tasks': {
    icon: ListChecks,
    title: 'All caught up',
    description: 'No pending tasks right now. New ones will appear as your plan progresses.',
  },
};

interface EmptyStateProps {
  variant?: EmptyVariant;
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
 * Designed empty state — never a blank screen. Warm gold icon disc, Playfair
 * heading, muted subtext, optional CTA. Server component.
 */
export function EmptyState({
  variant = 'no-matches',
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  action,
  className,
}: EmptyStateProps) {
  const preset = PRESETS[variant];
  const Icon = icon ?? preset.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gold/15">
        <Icon className="h-16 w-16 text-gold-muted" strokeWidth={1.25} aria-hidden="true" />
      </div>
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
