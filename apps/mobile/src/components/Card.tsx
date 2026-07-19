import { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Card — the standard surface container: rounded-2xl, gold/40 border, p-6.
 * Matches the web design system (cards rounded-2xl, buttons rounded-lg).
 */
interface CardProps {
  children: ReactNode;
  className?: string;
  testID?: string;
}

export function Card({ children, className = '', testID }: CardProps) {
  return (
    <View
      testID={testID}
      className={`bg-surface rounded-2xl border border-gold/40 p-6 ${className}`}
    >
      {children}
    </View>
  );
}
