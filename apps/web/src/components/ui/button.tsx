import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-0 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Existing variants kept verbatim for back-compat (default=teal, primary=burgundy).
        default:
          'bg-teal text-white shadow-sm hover:-translate-y-px hover:bg-teal-hover hover:shadow-md',
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:-translate-y-px hover:bg-primary-hover hover:shadow-md',
        // New: explicit Burgundy brand CTA (alias of primary, named per design system).
        brand:
          'bg-primary text-primary-foreground shadow-sm hover:-translate-y-px hover:bg-primary-hover hover:shadow-md',
        // New: quiet white card-action with a warm gold hairline.
        secondary:
          'border border-gold/40 bg-surface text-primary shadow-sm hover:-translate-y-px hover:border-gold hover:bg-surface-muted',
        gold:
          'bg-gold text-white shadow-sm hover:-translate-y-px hover:bg-gold-muted hover:shadow-md',
        outline:
          'border border-border bg-surface text-foreground hover:border-teal hover:bg-teal/5 hover:text-teal',
        ghost:
          'text-foreground hover:bg-secondary hover:text-primary',
        link:
          'min-h-0 text-teal underline-offset-4 hover:underline',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:-translate-y-px hover:bg-destructive/90',
        subtle:
          'bg-secondary text-foreground hover:bg-border',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm:      'h-9 px-3 text-xs',
        lg:      'h-12 px-6 text-base',
        icon:    'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Shows a centred spinner in place of the label while keeping the button's
   * width (children stay mounted but hidden). Auto-disables the button.
   * Ignored when `asChild` (Slot requires a single child).
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size, className }))}
          {...props}
        >
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin" aria-hidden="true" />
          </span>
        )}
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
          {children}
        </span>
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
