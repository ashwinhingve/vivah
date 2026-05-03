export default function WeddingLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 animate-pulse">
        {/* Back link skeleton */}
        <div className="h-4 w-28 rounded bg-secondary mb-6" />

        {/* Heading skeleton */}
        <div className="h-7 w-56 rounded bg-secondary mb-2" />
        <div className="h-4 w-32 rounded bg-secondary mb-6" />

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-gold/20 rounded-xl shadow-sm p-4 h-20"
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-surface border border-gold/20 rounded-xl shadow-sm p-5 mb-6">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-32 rounded bg-secondary" />
            <div className="h-4 w-10 rounded bg-secondary" />
          </div>
          <div className="h-2 w-full rounded-full bg-secondary" />
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-surface border border-gold/20 rounded-xl shadow-sm p-1 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 h-11 rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    </div>
  );
}
