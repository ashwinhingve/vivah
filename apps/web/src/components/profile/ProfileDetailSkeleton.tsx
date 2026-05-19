/**
 * ProfileDetailSkeleton
 *
 * Warm shimmer skeleton matching the 2-column profile detail layout.
 * Used as the Suspense fallback for the profile detail page.
 */
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';

export function ProfileDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left: photo + hero */}
        <div className="space-y-4">
          {/* Photo */}
          <SkeletonBlock className="w-full aspect-[4/5] rounded-2xl" />
          {/* Thumbnail row */}
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="w-16 h-16 rounded-xl flex-shrink-0" />
            ))}
          </div>
          {/* Hero name + meta */}
          <div className="rounded-2xl border border-gold/20 bg-surface p-5 space-y-3">
            <SkeletonBlock className="h-7 w-2/3 rounded-lg" />
            <SkeletonBlock className="h-4 w-1/2 rounded" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-5 w-20 rounded-full" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
              <SkeletonBlock className="h-5 w-24 rounded-full" />
            </div>
            {/* Verification strip */}
            <div className="flex gap-3 pt-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-8 w-16 rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Right: compatibility + tabs */}
        <div className="space-y-4">
          {/* Compatibility card */}
          <div className="rounded-2xl border border-gold/20 bg-surface p-5 space-y-4">
            <div className="flex items-center gap-4">
              <SkeletonBlock className="w-24 h-24 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-5 w-28 rounded-full" />
                <SkeletonBlock className="h-4 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-3 w-8" />
                  </div>
                  <SkeletonBlock className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-2xl border border-gold/20 bg-surface overflow-hidden">
            <div className="flex border-b border-gold/20">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} className="flex-1 h-10 rounded-none" />
              ))}
            </div>
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
