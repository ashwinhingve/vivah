import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lift + deepen shadow on hover (150ms). Opt-in. */
  hover?: boolean;
  /** Root padding. Opt-in — omit when using CardHeader/CardContent (they own spacing). */
  padding?: 'sm' | 'md' | 'lg';
  /** Premium treatment: warm-gold ring + glow. */
  premium?: boolean;
}

const paddingMap = { sm: 'p-4', md: 'p-6', lg: 'p-8' } as const;

const CardRoot = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, padding, premium = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-gold/20 bg-surface text-foreground shadow-card',
        padding && paddingMap[padding],
        hover &&
          'transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-card-hover',
        premium && 'border-gold/40 shadow-gold-glow',
        className
      )}
      {...props}
    />
  )
);
CardRoot.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-heading text-lg font-semibold leading-tight tracking-tight text-primary',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

/**
 * `Card` is also a namespace: `Card.Header` / `Card.Body` / `Card.Footer`
 * (Body === CardContent). The flat named exports stay for back-compat.
 */
const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardContent,
  Footer: CardFooter,
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
