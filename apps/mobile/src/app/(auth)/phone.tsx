import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { phoneNumberMethods } from '../../lib/auth-client';
import { phoneSchema } from '../../utils/validation';
import { Screen } from '@/components/Screen';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { InfoNote } from '@/components/InfoNote';

/**
 * Phone entry screen.
 *
 * Collects phone number, validates, sends OTP via Better Auth,
 * then navigates to verify screen on success.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePhone = useCallback((text: string) => {
    setPhone(text);
    setError(null);
  }, []);

  const handleSendOtp = useCallback(async () => {
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
  }, [phone, router]);

  return (
    <Screen scroll keyboardAvoiding>
      {/* Header */}
      <View className="mb-8">
        <Text className="text-primary font-heading-bold text-3xl mb-2">Welcome</Text>
        <Text className="text-gold-muted text-base">Enter your phone to get started</Text>
      </View>

      {/* Phone Input */}
      <Input
        label="Phone Number"
        containerClassName="mb-6"
        placeholder="10-digit number or +91XXXXXXXXXX"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        editable={!isLoading}
        value={phone}
        onChangeText={handleChangePhone}
      />

      {/* Error Message */}
      {error ? <ErrorBanner message={error} className="mb-6" /> : null}

      {/* Send OTP Button */}
      <Button
        title="Send OTP"
        onPress={handleSendOtp}
        loading={isLoading}
        disabled={!phone.trim()}
        accessibilityHint="Sends a one-time code to your phone by SMS"
      />

      {/* Info Note */}
      <InfoNote variant="warning" className="mt-8">
        Pre-launch scaffold — not live. In mock mode, use any phone number and the OTP code
        configured in env.
      </InfoNote>
    </Screen>
  );
}
