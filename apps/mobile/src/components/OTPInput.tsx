import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * OTPInput — segmented 6-digit code entry backed by a single hidden
 * TextInput (one source of truth, no per-cell focus juggling).
 * Fires onComplete when all 6 digits are entered; shakes on error.
 */
export const OTP_LENGTH = 6;

interface OTPInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onComplete?: (otp: string) => void;
  error?: string | null;
  editable?: boolean;
  testID?: string;
}

export function OTPInput({
  value,
  onChangeText,
  onComplete,
  error,
  editable = true,
  testID,
}: OTPInputProps) {
  const { colors } = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [error, shake]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const handleChange = useCallback(
    (text: string) => {
      const digits = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      onChangeText(digits);
      if (digits.length === OTP_LENGTH) {
        onComplete?.(digits);
      }
    },
    [onChangeText, onComplete],
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <View>
      <Pressable
        onPress={focusInput}
        accessible
        accessibilityLabel="One-time code, 6 digits"
        accessibilityHint="Enter the 6-digit code sent to you by SMS"
        accessibilityValue={{ text: value ? `${value.length} of ${OTP_LENGTH} digits entered` : 'Empty' }}
      >
        <Animated.View style={animatedStyle}>
          <View className="flex-row justify-between">
            {Array.from({ length: OTP_LENGTH }, (_, i) => {
              const digit = value[i] ?? '';
              const isActive = focused && i === activeIndex;
              const borderClass = error
                ? 'border-destructive'
                : isActive
                  ? 'border-teal'
                  : 'border-gold/40';
              return (
                <View
                  key={i}
                  className={`w-12 h-14 rounded-lg border bg-surface items-center justify-center ${borderClass}`}
                >
                  <Text className="text-ink text-xl font-semibold">
                    {digit}
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        editable={editable}
        autoFocus
        caretHidden
        accessible={false}
        importantForAccessibility="no"
        className="absolute h-px w-px opacity-0"
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
