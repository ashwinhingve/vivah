import { Text, View } from 'react-native';

/**
 * LedgerRow — one money line inside a grouped Card (statement activity,
 * invoice lists): title + optional description/meta on the left, the formatted
 * amount on the right. Pass `divider` on every row but the last.
 */
interface LedgerRowProps {
  title: string;
  description?: string;
  meta?: string;
  amount: string;
  /** `success` for money in; `ink` for money out and neutral totals. */
  amountTone?: 'success' | 'ink';
  divider?: boolean;
  testID?: string;
}

export function LedgerRow({
  title,
  description,
  meta,
  amount,
  amountTone = 'ink',
  divider = false,
  testID,
}: LedgerRowProps) {
  return (
    <View
      testID={testID}
      className={`flex-row items-start justify-between gap-3 px-4 py-3.5 ${
        divider ? 'border-b border-gold/15' : ''
      }`}
    >
      <View className="flex-1">
        <Text className="font-semibold text-sm text-ink" numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text className="text-xs text-muted mt-0.5" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
        {meta ? <Text className="text-2xs text-muted mt-0.5">{meta}</Text> : null}
      </View>
      <Text
        className={`text-sm font-semibold ${
          amountTone === 'success' ? 'text-success' : 'text-ink'
        }`}
      >
        {amount}
      </Text>
    </View>
  );
}
