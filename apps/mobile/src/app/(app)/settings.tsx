import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AppHeader } from '../../components/AppHeader';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Eyebrow } from '../../components/Ornament';
import { SwitchRow } from '../../components/SwitchRow';
import { SkeletonRow } from '../../components/Skeleton';
import { EmptyState } from '../../components/States';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/useSession';
import {
  canUseBiometric,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
} from '../../lib/biometric';

/** Label/value line inside the grouped account card. */
function InfoRow({
  label,
  children,
  divider = false,
}: {
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <View className={`px-4 py-3.5 ${divider ? 'border-b border-gold/15' : ''}`}>
      <Text className="text-xs text-muted mb-1">{label}</Text>
      {children}
    </View>
  );
}

/** Section wrapper: gold eyebrow + staggered entrance. */
function Section({
  eyebrow,
  index,
  children,
}: {
  eyebrow?: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 8) * 60).duration(300)}
      className="mb-8"
    >
      {eyebrow ? <Eyebrow text={eyebrow} className="mb-4" /> : null}
      {children}
    </Animated.View>
  );
}

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
    return (
      <Screen scroll>
        <AppHeader title="Settings" showBack />
        <Card className="p-0 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      </Screen>
    );
  }

  const isVerified = profile?.verificationStatus === 'VERIFIED';
  const isPremium = profile?.premiumTier === 'PREMIUM';
  const biometricDescription = !biometricCheckDone
    ? 'Checking device...'
    : !biometricAvailable
      ? biometricReason === 'no_hardware'
        ? 'No biometric hardware on this device'
        : 'No biometrics enrolled on this device'
      : 'Unlock your account with fingerprint or face';

  return (
    <Screen scroll>
      <AppHeader title="Settings" showBack />

      <Section eyebrow="Account" index={0}>
        <Card className="p-0 overflow-hidden">
          <InfoRow label="Email" divider>
            <Text className="font-semibold text-ink">
              {profile?.email || 'Not set'}
            </Text>
          </InfoRow>

          <InfoRow label="Phone" divider>
            <Text className="font-semibold text-ink">
              {profile?.phoneNumber || 'Not set'}
            </Text>
          </InfoRow>

          <InfoRow label="Verification Status" divider>
            <Badge
              label={profile?.verificationStatus || 'PENDING'}
              variant={isVerified ? 'successSolid' : 'warning'}
              size="sm"
            />
          </InfoRow>

          {/* No "Change Password": accounts sign in with phone OTP, there is no
              password credential to change. */}
          <InfoRow label="Sign-in method">
            <Text className="font-semibold text-ink">Phone OTP</Text>
          </InfoRow>
        </Card>
      </Section>

      <Section eyebrow="Subscription" index={1}>
        <Card elevated className="mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs text-muted">Current Plan</Text>
            {isPremium && <Badge label="Active" variant="goldSolid" size="sm" />}
          </View>
          <Text className="font-heading text-xl text-primary">
            {profile?.premiumTier || 'Standard'}
          </Text>

          <View className="border-t border-gold/15 mt-4 pt-3">
            <Text className="text-xs text-muted mb-1">Member Since</Text>
            <Text className="font-semibold text-ink">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
        </Card>

        {!isPremium && (
          <Button
            title="Upgrade to Premium"
            variant="primary"
            onPress={() => router.push('/(app)/billing')}
          />
        )}
      </Section>

      <Section eyebrow="Security" index={2}>
        <Card className="p-0 overflow-hidden">
          <SwitchRow
            label="Biometric Unlock"
            description={biometricDescription}
            descriptionTone={
              biometricCheckDone && !biometricAvailable ? 'warning' : 'muted'
            }
            value={biometricEnabled && biometricAvailable}
            onValueChange={handleBiometricToggle}
            disabled={!biometricAvailable || !biometricCheckDone}
            testID="biometric-toggle"
          />
        </Card>
      </Section>

      <Section eyebrow="Privacy & Safety" index={3}>
        <Card className="p-0 overflow-hidden mb-4">
          <SwitchRow
            label="Online Status"
            description="Shown automatically while you use the app"
            value={profile?.isActive || false}
            onValueChange={() => undefined}
            disabled
          />
        </Card>

        <Button
          title="Manage Blocked Users"
          variant="secondary"
          onPress={() => router.push('/(app)/blocked-users')}
        />
      </Section>

      <Section eyebrow="Help & Support" index={4}>
        <Button
          title="FAQs"
          variant="secondary"
          onPress={() => router.push('/(app)/help')}
        />
      </Section>

      <Section index={5}>
        <Button
          title="Sign Out"
          variant="ghostDestructive"
          onPress={() => {
            // Sign out logic
            router.replace('/(auth)/phone');
          }}
        />
      </Section>
    </Screen>
  );
}
