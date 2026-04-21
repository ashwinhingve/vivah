import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-teal text-white shadow-sm hover:bg-teal-hover hover:shadow-md',
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md',
        gold:
          'bg-gold text-white shadow-sm hover:bg-gold-muted hover:shadow-md',
        outline:
          'border border-border bg-surface text-foreground hover:border-teal hover:bg-teal/5 hover:text-teal',
        ghost:
          'text-foreground hover:bg-secondary hover:text-primary',
        link:
          'text-teal underline-offset-4 hover:underline',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        subtle:
          'bg-secondary text-foreground hover:bg-border',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm:      'h-9 px-3 text-xs',
        lg:      'h-[52px] px-8 text-base',
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
