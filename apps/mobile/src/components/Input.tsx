import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Input — labeled TextInput with error + hint states and a11y built in.
 * 44px min height, gold/40 border (destructive when errored), themed
 * placeholder color. Forwards all other TextInput props.
 */
interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  error?: string | null;
  hint?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  hint,
  accessibilityLabel,
  containerClassName = '',
  ...inputProps
}: InputProps) {
  const { colors } = useThemeColors();

  return (
    <View className={containerClassName}>
      {label ? (
        <Text className="text-ink text-sm font-semibold mb-2">{label}</Text>
      ) : null}
      <TextInput
        {...inputProps}
        accessible
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        className={`min-h-11 px-4 py-2 rounded-lg bg-surface text-ink text-base border ${
          error ? 'border-destructive' : 'border-gold/40'
        }`}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-destructive text-sm mt-2"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-muted text-xs mt-2">{hint}</Text>
      ) : null}
    </View>
  );
}
