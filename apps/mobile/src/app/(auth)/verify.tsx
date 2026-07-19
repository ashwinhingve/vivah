import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { phoneNumberMethods } from '../../lib/auth-client';
import { otpSchema } from '../../utils/validation';
import { Screen } from '@/components/Screen';
import { OTPInput, OTP_LENGTH } from '@/components/OTPInput';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { InfoNote } from '@/components/InfoNote';

/**
 * OTP verification screen.
 *
 * Accepts a 6-digit code sent via SMS (segmented input, auto-submits when
 * complete), verifies via Better Auth, then redirects to the authenticated
 * home. Includes resend with a 30s cooldown.
 */
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Resend cooldown ticker — one timeout per second remaining.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleChangeOtp = useCallback((text: string) => {
    setOtp(text);
    setError(null);
  }, []);

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!phone) {
        return;
      }
      setError(null);

      // Validate OTP format (6 digits)
      const result = otpSchema.safeParse(code);
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

        // Success — session is now active, land on the Matches tab
        router.replace('/(app)/(matches)');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid OTP or verification failed.';
        setError(message);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsLoading(false);
      }
    },
    [phone, router],
  );

  const handleResend = useCallback(async () => {
    if (!phone) {
      return;
    }
    setError(null);
    setIsResending(true);
    try {
      await phoneNumberMethods.sendOtp({ phoneNumber: phone });
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend OTP. Try again.';
      setError(message);
    } finally {
      setIsResending(false);
    }
  }, [phone]);

  if (!phone) {
    return (
      <Screen contentClassName="px-6 py-8 justify-center">
        <ErrorBanner message="Phone number missing. Go back and try again." className="mb-6" />
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      {/* Header */}
      <View className="mb-8">
        <Text className="text-primary font-heading-bold text-3xl mb-2">Verify OTP</Text>
        <Text className="text-gold-muted text-base">
          We&apos;ve sent a code to {phone}
        </Text>
      </View>

      {/* OTP Input — auto-submits when all 6 digits are entered */}
      <View className="mb-6">
        <Text className="text-ink text-sm font-semibold mb-2">6-Digit Code</Text>
        <OTPInput
          value={otp}
          onChangeText={handleChangeOtp}
          onComplete={handleVerifyOtp}
          error={error}
          editable={!isLoading}
          testID="otp-input"
        />
      </View>

      {/* Error Message */}
      {error ? <ErrorBanner message={error} className="mb-6" /> : null}

      {/* Verify Button */}
      <Button
        title="Verify"
        onPress={() => void handleVerifyOtp(otp)}
        loading={isLoading}
        disabled={otp.length !== OTP_LENGTH}
        accessibilityHint="Verifies the code and signs you in"
      />

      {/* Resend */}
      <View className="mt-6 items-center">
        {cooldown > 0 ? (
          <Text className="text-muted text-sm" accessibilityLiveRegion="polite">
            Resend code in {cooldown}s
          </Text>
        ) : (
          <Button
            title="Resend Code"
            variant="secondary"
            onPress={handleResend}
            loading={isResending}
            disabled={isLoading}
            accessibilityHint="Sends a new one-time code to your phone"
          />
        )}
      </View>

      {/* Info Note */}
      <InfoNote variant="info" title="Mock mode" className="mt-8">
        The OTP code is the configured MOCK_OTP_VALUE environment variable.
      </InfoNote>
    </Screen>
  );
}
