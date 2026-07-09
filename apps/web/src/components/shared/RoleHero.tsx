import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FadeUp } from '@/components/shared/FadeUp.client';
import { cn } from '@/lib/utils';

interface RoleHeroProps {
  /** Main heading — a greeting ("Good morning, Asha") or a title ("Support console"). */
  title: ReactNode;
  /** Muted supporting line under the title. */
  subtitle?: ReactNode;
  /** Right-aligned slot for badges / date pill / a primary action. */
  rightSlot?: ReactNode;
  /** Optional decorative icon shown left of the title. */
  icon?: LucideIcon;
  /** Optional progress bar under the title (0–100). */
  progress?: { pct: number; label?: string };
  className?: string;
}

/**
 * The signature Smart Shaadi hero — gradient wash + decorative blur orb +
 * Playfair heading. Reused across every role home so the app reads as one
 * premium system (matches dashboard/page.tsx and family/page.tsx).
 * Server-safe; wraps its content in FadeUp for the entrance cascade.
 */
export function RoleHero({ title, subtitle, rightSlot, icon: Icon, progress, className }: RoleHeroProps) {
  return (
    <FadeUp>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-primary/5 via-surface to-gold/10 px-5 py-5 shadow-card sm:px-7 sm:py-6 lg:px-8 lg:py-7',
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
        />

        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-surface/70 text-primary shadow-sm">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-heading text-[22px] font-semibold leading-tight tracking-tight text-primary sm:text-[28px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {rightSlot && <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>}
        </div>

        {progress && (
          <div className="relative mt-4 flex items-center gap-3">
            {progress.label && (
              <p className="shrink-0 text-xs font-medium text-muted-foreground">{progress.label}</p>
            )}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gold/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal to-teal-hover transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </FadeUp>
  );
}
