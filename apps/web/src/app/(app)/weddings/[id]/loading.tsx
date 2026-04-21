export default function WeddingLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEFAF6' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24 animate-pulse">
        {/* Back link skeleton */}
        <div className="h-4 w-28 rounded bg-[#F5EFE8] mb-6" />

        {/* Heading skeleton */}
        <div className="h-7 w-56 rounded bg-[#F5EFE8] mb-2" />
        <div className="h-4 w-32 rounded bg-[#F5EFE8] mb-6" />

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-4 h-20"
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-5 mb-6">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-32 rounded bg-[#F5EFE8]" />
            <div className="h-4 w-10 rounded bg-[#F5EFE8]" />
          </div>
          <div className="h-2 w-full rounded-full bg-[#F5EFE8]" />
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white border border-[#C5A47E]/20 rounded-xl shadow-sm p-1 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 h-11 rounded-lg bg-[#F5EFE8]" />
          ))}
        </div>
      </div>
    </div>
  );
}
