// Skeleton loading state — mirrors the real feed layout (max-w-7xl, sidebar +
// 2→4 col grid) so there is no layout shift on hydration. The card skeleton
// matches the live ProfileCard footprint (aspect-[4/5] + skeleton-warm).
// Inlined (not ProfileCard.Skeleton) because this is a Server Component and the
// compound client export's static `.Skeleton` prop is undefined across the RSC boundary.

function SkeletonCard() {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border border-gold/20 bg-surface shadow-card"
      aria-hidden="true"
    >
      <div className="skeleton-warm aspect-[4/5] w-full" />
      <div className="flex flex-col gap-3 p-3.5">
        <div className="flex gap-2">
          <div className="skeleton-warm h-6 w-24 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="skeleton-warm h-11 flex-1 rounded-lg" />
            <div className="skeleton-warm h-11 flex-1 rounded-lg" />
          </div>
          <div className="skeleton-warm h-11 w-full rounded-lg" />
        </div>
      </div>
    </article>
  );
}

export default function FeedLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header skeleton (matches feed/page.tsx heading + subtitle) */}
        <div className="mb-6 space-y-2">
          <div className="skeleton-warm h-7 w-44 rounded-lg sm:h-8" />
          <div className="skeleton-warm h-4 w-64 rounded-full" />
        </div>

        <div className="flex gap-6">
          {/* Desktop filter sidebar placeholder */}
          <aside className="hidden w-[260px] shrink-0 lg:block" aria-hidden="true">
            <div className="space-y-3 rounded-2xl border border-gold/20 bg-surface p-4 shadow-card">
              <div className="skeleton-warm h-5 w-24 rounded-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton-warm h-9 w-full rounded-lg" />
              ))}
            </div>
          </aside>

          {/* Card grid — same columns/gap as the live feed */}
          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
