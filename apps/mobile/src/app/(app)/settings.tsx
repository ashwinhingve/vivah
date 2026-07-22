import { useRouter } from 'expo-router';
import { Text, View, Switch } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { LoadingState, EmptyState } from '../../components/States';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/useSession';
import { tokens } from '../../theme/tokens';
import {
  canUseBiometric,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
} from '../../lib/biometric';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricCheckDone, setBiometricCheckDone] = useState(false);
  const [biometricReason, setBiometricReason] = useState<'no_hardware' | 'not_enrolled' | undefined>();

  // Fetch profile to show subscription/settings info
  const {
    data: profile,
    isLoading,
  } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => api.profiles.getMe(),
    enabled: !!session,
  });

  // On mount, check biometric state
  useEffect(() => {
    const checkBiometric = async () => {
      const enabled = await isBiometricEnabled();
      setBiometricEnabled(enabled);

      const check = await canUseBiometric();
      setBiometricAvailable(check.canUse);
      setBiometricReason(check.reason);
      setBiometricCheckDone(true);
    };

    checkBiometric();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (!biometricAvailable) return;

    try {
      if (value) {
        await enableBiometric();
      } else {
        await disableBiometric();
      }
      setBiometricEnabled(value);
    } catch (error) {
      console.error('[settings] biometric toggle error:', error);
    }
  };

  if (!session) {
    return (
      <Screen>
        <EmptyState
          title="Please sign in"
          message="You need to be signed in to access settings."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return <LoadingState label="Loading settings..." />;
  }

  return (
    <Screen scroll>
      {/* Header */}
      <Text className="font-heading text-2xl text-primary mb-6">Settings</Text>

      {/* Account Section */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Account</Text>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <Text className="text-sm text-muted mb-1">Email</Text>
          <Text className="font-semibold text-ink">
            {profile?.email || 'Not set'}
          </Text>
        </View>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <Text className="text-sm text-muted mb-1">Phone</Text>
          <Text className="font-semibold text-ink">
            {profile?.phoneNumber || 'Not set'}
          </Text>
        </View>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <Text className="text-sm text-muted mb-1">Verification Status</Text>
          <View className="flex-row items-center gap-2">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: profile?.verificationStatus === 'VERIFIED' ? tokens.success : tokens.warning }}
            />
            <Text className="font-semibold text-ink">
              {profile?.verificationStatus || 'PENDING'}
            </Text>
          </View>
        </View>

        {/* No "Change Password": accounts sign in with phone OTP, there is no
            password credential to change. */}
        <View className="bg-surface border border-gold/20 rounded-xl p-4">
          <Text className="text-sm text-muted mb-1">Sign-in method</Text>
          <Text className="font-semibold text-ink">Phone OTP</Text>
        </View>
      </View>

      {/* Subscription Section */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Subscription</Text>

        <View className="bg-gold/10 border border-gold/40 rounded-xl p-4 mb-4">
          <Text className="text-sm text-muted mb-2">Current Plan</Text>
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-lg text-primary">
              {profile?.premiumTier || 'Standard'}
            </Text>
            {profile?.premiumTier === 'PREMIUM' && (
              <View className="bg-gold/20 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-primary">Active</Text>
              </View>
            )}
          </View>
        </View>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <Text className="text-sm text-muted mb-1">Member Since</Text>
          <Text className="font-semibold text-ink">
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString()
              : 'N/A'}
          </Text>
        </View>

        {profile?.premiumTier !== 'PREMIUM' && (
          <Button
            title="Upgrade to Premium"
            variant="primary"
            onPress={() => router.push('/(app)/billing')}
          />
        )}
      </View>

      {/* Security */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Security</Text>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-semibold text-ink mb-1">Biometric Unlock</Text>
              {!biometricCheckDone ? (
                <Text className="text-xs text-muted">Checking device...</Text>
              ) : !biometricAvailable ? (
                <Text className="text-xs text-warning">
                  {biometricReason === 'no_hardware'
                    ? 'No biometric hardware on this device'
                    : 'No biometrics enrolled on this device'}
                </Text>
              ) : (
                <Text className="text-xs text-muted">
                  Unlock your account with fingerprint or face
                </Text>
              )}
            </View>
            <Switch
              value={biometricEnabled && biometricAvailable}
              onValueChange={handleBiometricToggle}
              disabled={!biometricAvailable || !biometricCheckDone}
              trackColor={{ false: '#d9d9d9', true: tokens.teal }}
              thumbColor={
                biometricEnabled && biometricAvailable ? tokens.primary : '#f4f3f4'
              }
              testID="biometric-toggle"
            />
          </View>
        </View>
      </View>

      {/* Privacy & Safety */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Privacy & Safety</Text>

        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-ink">Online Status</Text>
            <Switch
              value={profile?.isActive || false}
              disabled={true}
              trackColor={{ false: '#d9d9d9', true: tokens.teal }}
              thumbColor={profile?.isActive ? tokens.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <Button
          title="Manage Blocked Users"
          variant="secondary"
          onPress={() => router.push('/(app)/blocked-users')}
        />
      </View>

      {/* Help & Support */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Help & Support</Text>

        <Button
          title="FAQs"
          variant="secondary"
          onPress={() => router.push('/(app)/help')}
        />
      </View>

      {/* Logout */}
      <View className="mb-8">
        <Button
          title="Sign Out"
          variant="secondary"
          onPress={() => {
            // Sign out logic
            router.replace('/(auth)/phone');
          }}
        />
      </View>
    </Screen>
  );
}
