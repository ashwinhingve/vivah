import { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { phoneNumberMethods } from '../../lib/auth-client';
import { otpSchema } from '../../utils/validation';

/**
 * OTP verification screen — Phase-1.
 *
 * Accepts a 6-digit code sent via SMS, verifies via Better Auth,
 * then redirects to the authenticated home on success.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!phone) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-8 items-center justify-center">
        <Text className="text-destructive font-semibold">Phone number missing. Go back and try again.</Text>
      </ScrollView>
    );
  }

  const handleVerifyOtp = async () => {
    setError(null);

    // Validate OTP format (6 digits)
    const result = otpSchema.safeParse(otp);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid OTP format');
      return;
    }

    setIsLoading(true);
    try {
      // Call Better Auth phone OTP verify endpoint
      await phoneNumberMethods.verify({
        phoneNumber: phone,
        code: result.data,
      });

      // Success — session is now active, redirect to authenticated home
      router.replace('/(app)/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid OTP or verification failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-8">
      {/* Header */}
      <View className="mb-8">
        {/* TODO: Playfair Display heading via expo-font (Phase 7) */}
        <Text className="text-primary text-3xl font-bold mb-2">Verify OTP</Text>
        <Text className="text-gold-muted text-base">
          We&apos;ve sent a code to {phone}
        </Text>
      </View>

      {/* OTP Input */}
      <View className="mb-6">
        <Text className="text-primary text-sm font-semibold mb-2">6-Digit Code</Text>
        <TextInput
          className="border border-gold rounded-lg px-4 py-3 text-base text-center bg-surface text-primary font-mono min-h-11"
          placeholder="000000"
          placeholderTextColor="#6B6B76"
          keyboardType="number-pad"
          maxLength={6}
          editable={!isLoading}
          value={otp}
          onChangeText={(text) => {
            setOtp(text.replace(/[^0-9]/g, ''));
            if (error) setError(null);
          }}
        />
      </View>

      {/* Error Message */}
      {error && (
        <View className="mb-6 bg-surface border border-destructive/40 rounded-lg p-3">
          <Text className="text-destructive text-sm">{error}</Text>
        </View>
      )}

      {/* Verify Button */}
      <Pressable
        onPress={handleVerifyOtp}
        disabled={isLoading || otp.length !== 6}
        className={`py-3 px-6 rounded-lg flex-row items-center justify-center mb-4 min-h-11 ${
          isLoading || otp.length !== 6 ? 'bg-muted' : 'bg-teal'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="#FEFAF6" size="small" />
        ) : (
          <Text className="text-white font-semibold text-center">Verify</Text>
        )}
      </Pressable>

      {/* Info Note */}
      <View className="mt-8 p-4 bg-surface border border-teal/40 rounded-lg">
        <Text className="text-xs text-teal mb-2">
          <Text className="font-semibold">Mock mode:</Text> The OTP code is the configured MOCK_OTP_VALUE environment variable.
        </Text>
      </View>
    </ScrollView>
  );
}
