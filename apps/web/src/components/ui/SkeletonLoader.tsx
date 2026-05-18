import { cn } from '@/lib/utils';
import { ProfileCard } from './ProfileCard.client';

/** Single warm shimmer block. Compose these for any custom skeleton. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('skeleton-warm rounded-md', className)} aria-hidden="true" />;
}

/** Same footprint as ProfileCard. */
export const ProfileCardSkeleton = ProfileCard.Skeleton;

/** Avatar + two text lines — feed / search rows. */
export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-gold/20 bg-surface p-4',
        className
      )}
      aria-hidden="true"
    >
      <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/** Stat / metric tile placeholder. */
export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gold/20 bg-surface p-6',
        className
      )}
      aria-hidden="true"
    >
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-4 h-8 w-20" />
      <SkeletonBlock className="mt-3 h-3 w-16" />
    </div>
  );
}

/** Alternating chat bubble placeholders. */
export function ChatMessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      <SkeletonBlock className="h-10 w-2/3 rounded-2xl" />
      <SkeletonBlock className="ml-auto h-10 w-1/2 rounded-2xl" />
      <SkeletonBlock className="h-14 w-3/5 rounded-2xl" />
    </div>
  );
}

/** One table row of cells. */
export function TableRowSkeleton({
  cols = 4,
  className,
}: {
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center gap-4 border-b border-border-light px-4 py-3', className)}
      aria-hidden="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBlock key={i} className={cn('h-4 flex-1', i === 0 && 'max-w-[120px]')} />
      ))}
    </div>
  );
}
