export default function StoreLoading() {
  return (
    <main className="min-h-screen bg-[#FEFAF6] px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 bg-[#C5A47E]/20 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-72 bg-[#C5A47E]/10 rounded animate-pulse" />
        </div>

        {/* Category tabs skeleton */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-9 w-24 flex-shrink-0 bg-[#C5A47E]/20 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#C5A47E]/20 rounded-xl overflow-hidden">
              <div className="aspect-square bg-[#C5A47E]/10 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-14 bg-[#C5A47E]/20 rounded-full animate-pulse" />
                <div className="h-4 w-full bg-[#C5A47E]/15 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-[#C5A47E]/10 rounded animate-pulse" />
                <div className="h-5 w-20 bg-[#C5A47E]/20 rounded animate-pulse" />
                <div className="h-9 w-full bg-[#C5A47E]/15 rounded-lg animate-pulse mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
