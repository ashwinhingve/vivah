import { ShieldCheck, ShieldEllipsis, BadgeCheck, Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrustLevel =
  | 'unverified'
  | 'phone'
  | 'id'
  | 'family'
  | 'background';

interface TrustBadgeProps {
  level: TrustLevel;
  size?: 'sm' | 'md';
  className?: string;
}

const LEVEL_CONFIG: Record<
  TrustLevel,
  { label: string; icon: typeof ShieldCheck; classes: string }
> = {
  unverified: {
    label: 'Unverified',
    icon: ShieldEllipsis,
    classes: 'bg-muted text-muted-foreground',
  },
  phone: {
    label: 'Phone Verified',
    icon: Phone,
    classes: 'bg-muted text-muted-foreground',
  },
  id: {
    label: 'ID Verified',
    icon: ShieldCheck,
    classes: 'bg-teal/10 text-teal',
  },
  family: {
    label: 'Family Verified',
    icon: Sparkles,
    classes: 'bg-gold/15 text-gold-muted border border-gold/30',
  },
  background: {
    label: 'Background Verified',
    icon: BadgeCheck,
    classes: 'bg-success/10 text-success',
  },
};

/**
 * Unified verification ladder per ui-component.md Pattern 2.
 * Usage: <TrustBadge level="family" />
 */
export function TrustBadge({ level, size = 'sm', className }: TrustBadgeProps) {
  const { label, icon: Icon, classes } = LEVEL_CONFIG[level];
  const sizing =
    size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        sizing,
        classes,
        className
      )}
      aria-label={label}
    >
      <Icon className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {label}
    </span>
  );
}
