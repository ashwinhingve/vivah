import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  padded?: boolean;
}

export function Section({
  children,
  className,
  title,
  description,
  action,
  padded = true,
}: SectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface text-foreground shadow-card',
        padded && 'p-4 sm:p-6',
        className
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? (
              <h2 className="font-heading text-lg font-semibold text-primary">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
