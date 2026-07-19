/** Browse skeleton — warm-toned to match the ivory background, not grey. */
export default function PackagesLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-gold/15" />
        <div className="mt-3 h-5 w-40 animate-pulse rounded bg-gold/10" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-gold/10" />
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gold/20 bg-surface">
              <div className="aspect-[16/9] animate-pulse bg-gold/10" />
              <div className="space-y-3 p-4 sm:p-6">
                <div className="h-5 w-3/4 animate-pulse rounded bg-gold/15" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-gold/10" />
                <div className="h-4 w-full animate-pulse rounded bg-gold/10" />
                <div className="h-6 w-1/3 animate-pulse rounded bg-gold/15" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
