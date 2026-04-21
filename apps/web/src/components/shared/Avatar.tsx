'use client';

import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { Avatar as RadixAvatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const avatarVariants = cva('', {
  variants: {
    size: {
      sm: 'h-8 w-8 text-[10px]',
      md: 'h-10 w-10 text-xs',
      lg: 'h-12 w-12 text-sm',
      xl: 'h-16 w-16 text-lg',
    },
    frame: {
      none: '',
      gold: 'ring-2 ring-gold ring-offset-2 ring-offset-surface',
      verified: 'ring-2 ring-success ring-offset-2 ring-offset-surface',
    },
  },
  defaultVariants: {
    size: 'md',
    frame: 'none',
  },
});

interface UserAvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserAvatar({ name, src, size, frame, className }: UserAvatarProps) {
  return (
    <RadixAvatar className={cn(avatarVariants({ size, frame }), className)}>
      {src ? <AvatarImage src={src} alt={`${name}'s avatar`} /> : null}
      <AvatarFallback>{getInitials(name) || '♥'}</AvatarFallback>
    </RadixAvatar>
  );
}
