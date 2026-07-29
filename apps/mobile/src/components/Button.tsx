import { useCallback, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/hooks/useThemeColors';
import { shadowWarm } from '@/theme/shadows';

/**
 * Button — brand CTA with loading + disabled states, press-scale spring,
 * selection haptic, and a11y built in. Min height 44px (touch target).
 * Variants: primary (burgundy, warm shadow), secondary (teal outline),
 * destructive, ghost (quiet teal text), ghostDestructive (quiet red text).
 */
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'ghostDestructive';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon (~18–20px, colored by the caller). */
  icon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const containerClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-hover',
  secondary: 'bg-transparent border border-teal active:bg-teal/5',
  destructive: 'bg-destructive',
  ghost: 'bg-transparent active:bg-teal/5',
  ghostDestructive: 'bg-transparent active:bg-destructive/5',
};

const titleClass: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-teal',
  destructive: 'text-on-primary',
  ghost: 'text-teal',
  ghostDestructive: 'text-destructive',
};

const PRESS_SPRING = { damping: 20, stiffness: 350 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useThemeColors();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, PRESS_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_SPRING);
  }, [scale]);

  const handlePress = useCallback(() => {
    void Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  const spinnerColor =
    variant === 'secondary' || variant === 'ghost'
      ? colors.teal
      : variant === 'ghostDestructive'
        ? colors.destructive
        : colors.onPrimary;

  const elevate = variant === 'primary' && !isDisabled;

  return (
    <Animated.View style={[animatedStyle, elevate ? shadowWarm : null]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        className={`min-h-11 px-6 rounded-lg flex-row items-center justify-center gap-2 ${containerClass[variant]} ${isDisabled ? 'opacity-50' : ''}`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <>
            {icon}
            <Text className={`text-base font-semibold ${titleClass[variant]}`}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
