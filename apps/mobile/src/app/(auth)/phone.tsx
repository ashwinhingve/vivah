import { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneNumberMethods } from '../../lib/auth-client';
import { phoneSchema } from '../../utils/validation';

/**
 * Phone entry screen — Phase-1.
 *
 * Collects phone number, validates, sends OTP via Better Auth,
 * then navigates to verify screen on success.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async () => {
    setError(null);

    // Validate phone format
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid phone number');
      return;
    }

    setIsLoading(true);
    try {
      // Normalize to E.164 if it's a bare 10-digit number
      const normalized = result.data.startsWith('+') ? result.data : `+91${result.data}`;

      // Call Better Auth phone OTP endpoint
      await phoneNumberMethods.sendOtp({
        phoneNumber: normalized,
      });

      // Success — navigate to verify screen with the phone number
      router.push({
        pathname: '/(auth)/verify',
        params: { phone: normalized },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP. Try again.';
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
        <Text className="text-primary text-3xl font-bold mb-2">Welcome</Text>
        <Text className="text-gold-muted text-base">Enter your phone to get started</Text>
      </View>

      {/* Phone Input */}
      <View className="mb-6">
        <Text className="text-primary text-sm font-semibold mb-2">Phone Number</Text>
        <TextInput
          className="border border-gold rounded-lg px-4 py-3 text-base bg-surface text-primary min-h-11"
          placeholder="Enter 10-digit number or +91XXXXXXXXXX"
          placeholderTextColor="#6B6B76"
          keyboardType="phone-pad"
          editable={!isLoading}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
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

      {/* Send OTP Button */}
      <Pressable
        onPress={handleSendOtp}
        disabled={isLoading || !phone.trim()}
        className={`py-3 px-6 rounded-lg flex-row items-center justify-center mb-4 min-h-11 ${
          isLoading || !phone.trim() ? 'bg-muted' : 'bg-teal'
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="#FEFAF6" size="small" />
        ) : (
          <Text className="text-white font-semibold text-center">Send OTP</Text>
        )}
      </Pressable>

      {/* Info Note */}
      <View className="mt-8 p-4 bg-surface border border-warning/40 rounded-lg">
        <Text className="text-xs text-gold-muted">
          Pre-launch scaffold — not live. In mock mode, use any phone number and the OTP code configured in env.
        </Text>
      </View>
    </ScrollView>
  );
}
