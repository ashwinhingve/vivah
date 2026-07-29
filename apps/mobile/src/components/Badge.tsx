import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * Badge — pill-shaped status/label chip. Variants ported 1:1 from the web
 * design system (`components/ui/badge.tsx`): soft tints for states, solid
 * fills for emphasis, gold for premium/trust signals.
 */
export type BadgeVariant =
  | 'default'
  | 'teal'
  | 'tealSoft'
  | 'gold'
  | 'goldSolid'
  | 'success'
  | 'successSolid'
  | 'warning'
  | 'error'
  | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** Optional leading icon (sized by the caller, ~12–14px). */
  icon?: ReactNode;
  className?: string;
  testID?: string;
}

const containerClass: Record<BadgeVariant, string> = {
  default: 'bg-primary/10',
  teal: 'bg-teal',
  tealSoft: 'bg-teal/10',
  gold: 'bg-gold/15',
  goldSolid: 'bg-gold',
  success: 'bg-success/10',
  successSolid: 'bg-success',
  warning: 'bg-warning/10',
  error: 'bg-destructive/10',
  neutral: 'bg-ink/5',
};

const textClass: Record<BadgeVariant, string> = {
  default: 'text-primary',
  teal: 'text-on-primary',
  tealSoft: 'text-teal',
  gold: 'text-gold-muted',
  goldSolid: 'text-on-primary',
  success: 'text-success',
  successSolid: 'text-on-primary',
  warning: 'text-warning',
  error: 'text-destructive',
  neutral: 'text-muted',
};

export function Badge({ label, variant = 'default', size = 'md', icon, className = '', testID }: BadgeProps) {
  const sizing = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const textSize = size === 'sm' ? 'text-2xs' : 'text-xs';
  return (
    <View
      testID={testID}
      className={`flex-row items-center gap-1 self-start rounded-full ${sizing} ${containerClass[variant]} ${className}`}
    >
      {icon}
      <Text className={`font-semibold ${textSize} ${textClass[variant]}`}>{label}</Text>
    </View>
  );
}
