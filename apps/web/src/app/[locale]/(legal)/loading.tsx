export default function LegalLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gold/20 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-gold/10 rounded animate-pulse" />
        </div>

        {/* Content text wall skeleton */}
        <div className="space-y-3 mt-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-4 bg-gold/10 rounded animate-pulse" style={{
              width: i % 3 === 0 ? '95%' : i % 2 === 0 ? '90%' : '100%'
            }} />
          ))}
        </div>

        {/* Section break */}
        <div className="h-px bg-gold/20 my-8" />

        {/* Another section */}
        <div className="space-y-3">
          <div className="h-6 w-48 bg-gold/20 rounded-lg animate-pulse" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-gold/10 rounded animate-pulse" style={{
              width: i === 0 ? '100%' : '98%'
            }} />
          ))}
        </div>
      </div>
    </main>
  );
}
