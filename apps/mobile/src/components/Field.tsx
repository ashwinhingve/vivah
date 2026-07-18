import { Text, TextInput, TextInputProps, View } from 'react-native';

/**
 * Field — Phase-1 component.
 * Labeled TextInput wrapper. Label (ink color), input (gold/40 border, rounded, 44px).
 * Props: label (required), value, onChangeText, placeholder?, keyboardType?, maxLength?, autoFocus?
 */
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: number;
  autoFocus?: boolean;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
  autoFocus = false,
}: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-ink font-semibold mb-2">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className="h-11 px-3 rounded-lg bg-surface text-ink border border-gold/40"
        placeholderTextColor="#6B6B76" // muted
        style={{
          borderColor: '#C5A47E66', // gold/40
        }}
      />
    </View>
  );
}
