import { Switch, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { withAlpha } from '@/theme/tokens';

/**
 * SwitchRow — a labelled toggle row for settings-style grouped cards: label +
 * optional description on the left, the themed Switch on the right. Centralizes
 * the muted/teal track + burgundy/gold thumb treatment previously copy-pasted
 * per screen. Place inside a `Card className="p-0"` group and pass `divider`
 * on every row but the last.
 */
interface SwitchRowProps {
  label: string;
  description?: string;
  /** Tint for the description line — `warning` for "unavailable" hints. */
  descriptionTone?: 'muted' | 'warning';
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function SwitchRow({
  label,
  description,
  descriptionTone = 'muted',
  value,
  onValueChange,
  disabled = false,
  divider = false,
  testID,
  accessibilityLabel,
}: SwitchRowProps) {
  const { colors } = useThemeColors();

  return (
    <View
      className={`flex-row items-center justify-between gap-4 px-4 py-3.5 ${
        divider ? 'border-b border-gold/15' : ''
      }`}
    >
      <View className="flex-1">
        <Text className="font-semibold text-ink">{label}</Text>
        {description ? (
          <Text
            className={`text-xs mt-0.5 ${
              descriptionTone === 'warning' ? 'text-warning' : 'text-muted'
            }`}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: withAlpha(colors.muted, '40'), true: colors.teal }}
        thumbColor={value ? colors.primary : colors.gold}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </View>
  );
}
