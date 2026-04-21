import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden rounded-md bg-border/60 animate-pulse', className)}
      {...props}
    >
      <span className="absolute inset-0 shimmer" />
    </div>
  );
}

export { Skeleton };
