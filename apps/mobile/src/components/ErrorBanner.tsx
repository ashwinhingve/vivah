import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * ErrorBanner — inline error display with icon, announced politely to
 * screen readers. Replaces ad-hoc error boxes on form screens.
 */
interface ErrorBannerProps {
  message: string;
  className?: string;
  testID?: string;
}

export function ErrorBanner({ message, className = '', testID }: ErrorBannerProps) {
  const { colors } = useThemeColors();

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`bg-surface border border-destructive/40 rounded-lg p-4 flex-row items-center ${className}`}
    >
      <Ionicons name="alert-circle" size={20} color={colors.destructive} />
      <Text className="text-destructive text-sm ml-2 flex-1">{message}</Text>
    </View>
  );
}
