import { Stack } from 'expo-router';

/**
 * Auth group layout — Phase-1.
 * A Stack navigator for the phone OTP flow: phone → verify.
 * Screens in this group: phone.tsx, verify.tsx (owned by Teammate B).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FEFAF6' }, // bg-background
      }}
    />
  );
}
