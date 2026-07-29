import { ReactNode } from 'react';
import { View } from 'react-native';
import { shadowWarm, shadowWarmLg } from '@/theme/shadows';

/**
 * Card — the standard surface container: rounded-2xl, gold/20 hairline border,
 * warm burgundy-tinted shadow, p-6. Matches the web card recipe exactly
 * (`border-gold/20 shadow-card`); pass `elevated` for the hover-depth shadow.
 */
interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  testID?: string;
}

export function Card({ children, className = '', elevated = false, testID }: CardProps) {
  return (
    <View
      testID={testID}
      className={`bg-surface rounded-2xl border border-gold/20 p-6 ${className}`}
      style={elevated ? shadowWarmLg : shadowWarm}
    >
      {children}
    </View>
  );
}
