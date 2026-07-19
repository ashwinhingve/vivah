import { useState, useEffect } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authenticate, canUseBiometric } from '../../lib/biometric';
import { signOut } from '../../lib/auth-client';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useThemeColors } from '../../hooks/useThemeColors';
import { withAlpha } from '../../theme/tokens';

/**
 * Biometric unlock screen.
 *
 * Shown when:
 * - User has a valid session (already logged in)
 * - User has opted into biometric
 * - Device has hardware and enrolled biometrics
 * - App is opening or returning from background
 *
 * The sign-out escape hatch is non-negotiable — if the user's sensor fails
 * or their finger is injured, they must never be permanently locked out.
 * Signing out returns them to phone-OTP, which always works.
 */
export default function BiometricUnlockScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [canUse, setCanUse] = useState(false);
  const { colors } = useThemeColors();

  // On mount, verify hardware is still available
  useEffect(() => {
    const checkHardware = async () => {
      const check = await canUseBiometric();
      setCanUse(check.canUse);
      setHardwareCheckDone(true);

      if (!check.canUse) {
        // Hardware/enrollment went away — fall back to sign-out
        setError(
          check.reason === 'no_hardware'
            ? 'Biometric hardware not available. Please sign in again.'
            : 'No biometrics enrolled. Please sign in again.'
        );
      }
    };

    checkHardware();
  }, []);

  const handleUnlock = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await authenticate();

      if (success) {
        // Authentication succeeded — dismiss this screen by going back to app
        router.dismiss();
      } else {
        // User cancelled or authentication failed
        setError('Authentication failed. Please try again or sign in with your phone.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      // Redirect to auth flow
      router.replace('/(auth)/phone');
    } catch (err) {
      console.error('[biometric-unlock] sign out error:', err);
      setError('Failed to sign out. Please try again.');
      setIsLoading(false);
    }
  };

  if (!hardwareCheckDone) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center">
          <Text className="text-muted">Checking biometric hardware...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 justify-between py-8">
        {/* Top spacer */}
        <View />

        {/* Center content */}
        <View className="items-center px-4">
          {/* Icon */}
          <View
            className="w-16 h-16 rounded-full mb-6 items-center justify-center"
            style={{ backgroundColor: withAlpha(colors.primary, '15') }}
          >
            <Ionicons name="finger-print" size={32} color={colors.primary} />
          </View>

          {/* Title */}
          <Text className="font-heading text-2xl text-primary mb-2 text-center">
            Unlock Your Account
          </Text>

          {/* Subtitle */}
          <Text className="text-muted text-center text-base mb-8">
            Use your fingerprint or face to continue
          </Text>

          {/* Error state */}
          {error ? (
            <ErrorBanner message={error} className="mb-6" />
          ) : null}

          {/* Unlock button */}
          <Button
            title={isLoading ? 'Authenticating...' : 'Unlock'}
            onPress={handleUnlock}
            loading={isLoading}
            disabled={!canUse || isLoading}
            accessibilityLabel="Biometric unlock"
            accessibilityHint="Use your fingerprint or face to unlock the app"
            testID="biometric-unlock-button"
          />
        </View>

        {/* Bottom: Sign out escape hatch */}
        <View className="border-t border-gold/20 pt-4 px-4">
          <Text className="text-xs text-muted text-center mb-3">
            Having trouble? You can always sign in with your phone number.
          </Text>
          <Pressable
            onPress={handleSignOut}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityHint="Sign out and return to phone login"
            testID="biometric-sign-out"
            className={`py-3 ${isLoading ? 'opacity-50' : ''}`}
          >
            <Text className="text-teal text-center text-sm font-semibold">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
