import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContainerVariant = 'narrow' | 'default' | 'wide' | 'full';

const widthClass: Record<ContainerVariant, string> = {
  narrow: 'max-w-2xl',
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

interface ContainerProps {
  variant?: ContainerVariant;
  className?: string;
  children: ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

export function Container({ variant = 'default', className, children, as: Tag = 'div' }: ContainerProps) {
  const Component = Tag as 'div';
  return (
    <Component className={cn('mx-auto w-full px-4 sm:px-6', widthClass[variant], className)}>
      {children}
    </Component>
  );
}
