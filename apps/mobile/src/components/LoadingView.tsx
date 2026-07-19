import { ActivityIndicator, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * LoadingView — full-screen centered spinner with optional label.
 * Announced to screen readers as a progress indicator.
 */
interface LoadingViewProps {
  label?: string;
  testID?: string;
}

export function LoadingView({ label, testID }: LoadingViewProps) {
  const { colors } = useThemeColors();

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      className="flex-1 bg-background items-center justify-center"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text className="text-muted text-sm mt-4">{label}</Text> : null}
    </View>
  );
}
