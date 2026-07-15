export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-32 bg-gold/10 rounded animate-pulse mb-6" />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image gallery skeleton */}
          <div className="space-y-2">
            <div className="aspect-square rounded-xl border border-gold/20 bg-surface animate-pulse" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-16 h-16 rounded-lg border border-gold/20 bg-surface animate-pulse" />
              ))}
            </div>
          </div>

          {/* Details skeleton */}
          <div className="space-y-4">
            {/* Category badge */}
            <div className="h-6 w-24 bg-gold/20 rounded-full animate-pulse" />

            {/* Title */}
            <div className="space-y-2">
              <div className="h-6 w-full bg-gold/20 rounded-lg animate-pulse" />
              <div className="h-4 w-3/4 bg-gold/10 rounded animate-pulse" />
            </div>

            {/* Price */}
            <div className="flex gap-3">
              <div className="h-8 w-32 bg-gold/20 rounded-lg animate-pulse" />
              <div className="h-6 w-24 bg-gold/10 rounded-lg animate-pulse" />
            </div>

            {/* Stock badge */}
            <div className="h-6 w-28 bg-gold/20 rounded-full animate-pulse" />

            {/* Description lines */}
            <div className="space-y-2 pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-gold/10 rounded animate-pulse" style={{
                  width: i === 2 ? '60%' : '100%'
                }} />
              ))}
            </div>

            {/* Vendor info */}
            <div className="h-4 w-48 bg-gold/10 rounded animate-pulse pt-2" />

            {/* Add to cart button */}
            <div className="h-11 w-full bg-gold/20 rounded-lg animate-pulse mt-4" />
          </div>
        </div>

        {/* Related products section */}
        <section className="mt-10">
          <div className="h-6 w-40 bg-gold/20 rounded-lg animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-gold/20 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-gold/10" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-14 bg-gold/20 rounded-full" />
                  <div className="h-4 w-full bg-gold/15 rounded" />
                  <div className="h-4 w-3/4 bg-gold/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
