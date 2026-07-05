export default function WeddingLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Hero band */}
      <div className="h-40 rounded-2xl border border-gold/25 bg-surface shadow-card sm:h-44" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[7.5rem] rounded-xl border border-gold/20 bg-surface shadow-card" />
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-xl border border-gold/20 bg-surface shadow-card" />
        ))}
      </div>

      {/* Readiness + side card */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-44 rounded-2xl border border-gold/25 bg-surface shadow-card" />
        <div className="h-44 rounded-2xl border border-gold/25 bg-surface shadow-card" />
      </div>
    </div>
  );
}
