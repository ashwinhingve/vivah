/** Browse skeleton — warm-toned, matching the ivory background. */
export default function PostMarriageLoading() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-gold/15" />
        <div className="mt-3 h-5 w-72 animate-pulse rounded bg-gold/10" />
        <div className="mt-6 h-36 animate-pulse rounded-2xl bg-gold/10" />
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gold/20 bg-surface p-4 sm:p-6">
              <div className="flex gap-3">
                <div className="h-12 w-12 animate-pulse rounded-lg bg-gold/15" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-gold/10" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-gold/15" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-gold/10" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-gold/10" />
              </div>
              <div className="mt-4 h-6 w-1/3 animate-pulse rounded bg-gold/15" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
