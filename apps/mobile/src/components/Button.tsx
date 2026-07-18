import { ActivityIndicator, Pressable, Text } from 'react-native';

/**
 * Button — Phase-1 component.
 * Pressable-based with primary/secondary variants, loading state, and disabled state.
 * Props: title (required), onPress?, variant (primary|secondary), loading?, disabled?
 * Min height: 44px (h-11). Rounded, centered, typed.
 */
interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  const backgroundColor = isPrimary ? '#7B2D42' : 'transparent'; // primary or transparent
  const borderColor = isPrimary ? 'transparent' : '#0E7C7B'; // teal for secondary
  const textColor = isPrimary ? '#FFFFFF' : '#0E7C7B'; // white for primary, teal for secondary
  const disabledOpacity = isDisabled ? 0.5 : 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className="min-h-11 rounded-lg items-center justify-center"
      style={{
        backgroundColor,
        borderWidth: isPrimary ? 0 : 1,
        borderColor,
        opacity: disabledOpacity,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text
          style={{ color: textColor }}
          className="text-base font-semibold"
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
