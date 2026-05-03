'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface FilterSheetProps {
  /** Filter UI rendered inside the sheet on mobile and inline on desktop. */
  children: ReactNode;
  title?: string;
  description?: string;
  /** Number of active filters — shown as a badge on the trigger. */
  activeCount?: number;
  /** Render inline as a sidebar from the `lg:` breakpoint up. */
  desktopInline?: boolean;
  className?: string;
}

/**
 * FilterSheet — bottom-sheet on mobile, optional sidebar on desktop.
 * Pair with feed/vendor browse/store filters.
 */
export function FilterSheet({
  children,
  title = 'Filters',
  description,
  activeCount = 0,
  desktopInline = true,
  className,
}: FilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile / always-available trigger */}
      <div className={cn(desktopInline && 'lg:hidden', className)}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {title}
              {activeCount > 0 ? (
                <span
                  className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1.5 text-xs font-semibold text-white"
                  aria-label={`${activeCount} active filters`}
                >
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
            <div className="mt-4">{children}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar (when desktopInline) */}
      {desktopInline ? (
        <aside className="hidden lg:block lg:w-72 lg:shrink-0">
          <div className="sticky top-20 rounded-xl border border-border bg-surface p-5 shadow-card">
            <h2 className="font-heading text-base font-semibold text-primary">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            <div className="mt-4">{children}</div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
