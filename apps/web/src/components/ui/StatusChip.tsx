import { Badge, type BadgeProps } from '@/components/ui/badge';

/**
 * Semantic tones for status chips. Call sites own their domain map
 * (`Record<Status, StatusTone>`) and pass a localised label as children —
 * the same status string can carry different tones in different domains.
 */
export type StatusTone =
  | 'success'
  | 'warning'
  | 'error'
  | 'teal'
  | 'gold'
  | 'neutral'
  | 'primary';

const TONE_VARIANT: Record<StatusTone, BadgeProps['variant']> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  teal: 'tealSoft',
  gold: 'gold',
  neutral: 'neutral',
  primary: 'default',
};

export interface StatusChipProps extends Omit<BadgeProps, 'variant'> {
  tone: StatusTone;
}

export function StatusChip({ tone, ...props }: StatusChipProps) {
  return <Badge variant={TONE_VARIANT[tone]} {...props} />;
}
