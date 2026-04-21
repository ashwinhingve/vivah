import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'bg-primary/10 text-primary',
        teal:        'bg-teal text-white shadow-sm',
        tealSoft:    'bg-teal/10 text-teal',
        gold:        'bg-gold/15 text-gold-muted',
        goldSolid:   'bg-gold text-white',
        success:     'bg-success/10 text-success',
        successSolid:'bg-success text-white',
        warning:     'bg-warning/10 text-warning',
        error:       'bg-destructive/10 text-destructive',
        neutral:     'bg-muted text-muted-foreground',
        outline:     'border border-border bg-surface text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
