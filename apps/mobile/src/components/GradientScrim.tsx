import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * GradientScrim — legibility gradient laid over photos (web pattern:
 * `from-black/75 via-black/40 to-transparent`). Absolutely fills its parent;
 * parent needs `overflow-hidden` and relative positioning.
 */
interface GradientScrimProps {
  intensity?: 'low' | 'medium' | 'high';
  /** Which edge the dark end anchors to. */
  direction?: 'bottom' | 'top';
}

const STOPS: Record<NonNullable<GradientScrimProps['intensity']>, readonly [string, string, string]> = {
  low: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.35)'],
  medium: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)'],
  high: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.40)', 'rgba(0,0,0,0.75)'],
};

export function GradientScrim({ intensity = 'medium', direction = 'bottom' }: GradientScrimProps) {
  const colors = STOPS[intensity];
  return (
    <LinearGradient
      pointerEvents="none"
      colors={direction === 'bottom' ? colors : ([...colors].reverse() as [string, string, string])}
      style={StyleSheet.absoluteFill}
    />
  );
}
