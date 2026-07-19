import { Stack } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Auth group layout — a Stack navigator for the phone OTP flow:
 * phone → verify. Background follows the active theme.
 */
export default function AuthLayout() {
  const { colors } = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
