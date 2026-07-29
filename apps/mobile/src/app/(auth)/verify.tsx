import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Timer } from 'lucide-react-native';
import { phoneNumberMethods } from '../../lib/auth-client';
import { otpSchema } from '../../utils/validation';
import { Screen } from '@/components/Screen';
import { AuthHero } from '@/components/AuthHero';
import { Badge } from '@/components/Badge';
import { OTPInput, OTP_LENGTH } from '@/components/OTPInput';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { InfoNote } from '@/components/InfoNote';
import { usePlatformSettings } from '@/features/settings/platformSettingsHook';
import { tokens } from '@/theme/tokens';

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
  const platformSettings = usePlatformSettings();

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
    <Screen scroll keyboardAvoiding contentClassName="px-6 pt-10 pb-8">
      {/* Back to phone entry — the only way to fix a mistyped number besides
          the OS back gesture, which isn't discoverable for every user. */}
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to phone number entry"
        hitSlop={4}
        className="h-11 w-11 items-center justify-center rounded-full bg-gold/10 active:bg-gold/20 mb-2"
      >
        <ChevronLeft size={24} color={tokens.primary} />
      </Pressable>

      {/* Brand hero */}
      <AuthHero compact title="Verify your number" subtitle={`We've sent a code to ${phone}`} />

      {/* Test Mode Badge */}
      {platformSettings.data?.isMockMode && (
        <View className="items-center mb-6">
          <Badge variant="warning" label="Test mode — no real SMS is sent" />
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
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

        {error ? <ErrorBanner message={error} className="mb-6" /> : null}

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
            <View
              className="flex-row items-center gap-1.5 rounded-full bg-gold/10 px-4 py-2"
              accessibilityLiveRegion="polite"
            >
              <Timer size={14} color={tokens.goldMuted} />
              <Text className="text-gold-muted text-sm font-medium">
                Resend code in {cooldown}s
              </Text>
            </View>
          ) : (
            <Button
              title="Resend Code"
              variant="ghost"
              onPress={handleResend}
              loading={isResending}
              disabled={isLoading}
              accessibilityHint="Sends a new one-time code to your phone"
            />
          )}
        </View>

        <InfoNote variant="info" title="Test build" className="mt-8">
          No real SMS is sent in this test build. Enter the test OTP code shared with you.
        </InfoNote>
      </Animated.View>
    </Screen>
  );
}
