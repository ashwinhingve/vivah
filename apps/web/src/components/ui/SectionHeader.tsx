import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Renders a "View all →" link on the right when href is set. */
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}

/** In-page section heading with a subtle gold hairline underline. */
export function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View all',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'mb-4 flex items-end justify-between gap-4 border-b border-gold/20 pb-2.5',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="font-heading text-xl font-semibold leading-tight tracking-tight text-text-primary">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="group inline-flex shrink-0 items-center gap-1 pb-0.5 text-sm font-semibold text-teal transition-colors hover:text-teal-hover"
        >
          {viewAllLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
