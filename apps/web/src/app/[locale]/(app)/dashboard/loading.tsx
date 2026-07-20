import { Skeleton } from '@/components/ui/skeleton';

/** Layout-matched dashboard skeleton — mirrors hero, stat grid, completeness
 *  card and the two-column body so real content lands without layout shift. */
export default function Loading() {
  return (
    <main id="main-content" className="min-h-screen bg-background" aria-busy="true">
      <div className="mx-auto max-w-2xl space-y-7 px-4 py-6 lg:max-w-6xl">
        {/* Hero greeting */}
        <div className="rounded-2xl border border-gold/20 bg-surface px-5 py-5 shadow-card sm:px-7 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="min-h-[7.5rem] rounded-2xl" />
          ))}
        </div>

        {/* Completeness card */}
        <Skeleton className="h-44 w-full rounded-2xl" />

        {/* Body: main column + sidebar */}
        <div className="space-y-7 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          <div className="space-y-7 lg:col-span-2">
            {/* Today's Matches rail */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-56 shrink-0 sm:w-auto sm:flex-1">
                    <Skeleton className="aspect-[4/3] rounded-t-2xl rounded-b-none" />
                    <div className="space-y-2 rounded-b-2xl border border-t-0 border-gold/20 bg-surface p-3">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-11 w-full rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Events + conversations lists */}
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-3 h-6 w-44" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ))}
          </div>
          <aside className="space-y-7 lg:col-span-1">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="min-h-[64px] rounded-2xl" />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
