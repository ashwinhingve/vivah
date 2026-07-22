import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level loading skeletons.
 *
 * - `rows` (default): header + stacked rows, for list/detail routes.
 * - `mediaGrid`: browse grid of media cards (image + text), e.g. /packages.
 * - `iconGrid`: browse grid of icon cards, e.g. /services/post-marriage.
 */
type RouteSkeletonPreset = 'rows' | 'mediaGrid' | 'iconGrid';

function MediaCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gold/20 bg-surface">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-4 sm:p-6">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

function IconCard() {
  return (
    <div className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
      <div className="flex gap-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="mt-4 h-6 w-1/3" />
    </div>
  );
}

export function RouteSkeleton({
  rows = 4,
  withHeader = true,
  preset = 'rows',
}: {
  rows?: number;
  withHeader?: boolean;
  preset?: RouteSkeletonPreset;
}) {
  if (preset !== 'rows') {
    const Card = preset === 'mediaGrid' ? MediaCard : IconCard;
    return (
      <div className="min-h-screen bg-background">
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-8" aria-busy="true">
          <Skeleton className="h-9 w-60 rounded-lg" />
          <Skeleton className="mt-3 h-5 w-72 max-w-full" />
          <Skeleton className="mt-6 h-40 rounded-2xl" />
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
      {withHeader ? (
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
      ) : null}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
