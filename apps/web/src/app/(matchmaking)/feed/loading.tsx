// Skeleton loading state — mirrors the MatchFeedPage card grid layout

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] overflow-hidden flex flex-col animate-pulse">
      {/* Photo placeholder */}
      <div className="aspect-square w-full bg-gray-200 rounded-t-xl" />

      {/* Details */}
      <div className="p-4 flex flex-col gap-3">
        {/* Name + city */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded-full w-3/4" />
          <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        </div>

        {/* Guna + tier badges */}
        <div className="flex items-center gap-2">
          <div className="h-4 bg-gray-200 rounded-full w-24" />
          <div className="h-4 bg-gray-200 rounded-full w-16" />
        </div>

        {/* CTA button */}
        <div className="h-11 bg-gray-200 rounded-lg w-full mt-1" />
      </div>
    </div>
  );
}

export default function FeedLoading() {
  return (
    <main className="min-h-screen bg-[#FEFAF6]">
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2 animate-pulse">
          <div className="h-7 bg-gray-200 rounded-full w-40" />
          <div className="h-4 bg-gray-200 rounded-full w-56" />
        </div>

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </main>
  );
}
