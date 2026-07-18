import { Text, View } from 'react-native';

/**
 * Phase-0 placeholder home. Teammate B replaces this with the auth gate that
 * redirects to the phone-OTP flow when unauthenticated, or the (app) home when
 * a Better Auth cookie session exists. The `className` props below exist only to
 * prove NativeWind + the design tokens resolve in the frozen base.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-primary text-2xl font-semibold text-center">
        Smart Shaadi
      </Text>
      <Text className="text-gold-muted mt-2 text-center">
        Mobile scaffold — pre-launch, not live
      </Text>
    </View>
  );
}
