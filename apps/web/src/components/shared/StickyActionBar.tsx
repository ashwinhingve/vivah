import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  /** When true the bar is hidden on >=sm screens (mobile-only CTA). */
  mobileOnly?: boolean;
}

/**
 * StickyActionBar — pinned bottom CTA bar with safe-area inset.
 * Pair with `pb-24` on the page so content isn't covered.
 */
export function StickyActionBar({ children, className, mobileOnly = true }: StickyActionBarProps) {
  return (
    <div
      role="region"
      aria-label="Primary action"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur',
        'px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3',
        'shadow-card-hover',
        mobileOnly && 'sm:hidden',
        className
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-end gap-3">{children}</div>
    </div>
  );
}
