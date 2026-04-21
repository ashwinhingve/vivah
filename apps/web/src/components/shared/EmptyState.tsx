import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gold/40 bg-surface-muted/50 px-6 py-12 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-muted">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="font-heading text-lg font-semibold text-primary">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
