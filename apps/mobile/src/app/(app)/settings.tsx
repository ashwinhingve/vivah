import { useRouter } from 'expo-router';
import { Text, View, ScrollView, Switch } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { LoadingState, EmptyState } from '../../components/States';
import { api } from '../../lib/api';
import { useSession } from '../../hooks/useSession';
import { tokens } from '../../theme/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const { data: session } = useSession();

  // Fetch profile to show subscription/settings info
  const {
    data: profile,
    isLoading,
  } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => api.profiles.getMe(),
    enabled: !!session,
  });

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

        <Button
          title="Change Password"
          variant="secondary"
          onPress={() => {
            // In-app purchase flow is out of scope
          }}
        />
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

        {profile?.premiumTier === 'STANDARD' && (
          <Button
            title="Upgrade to Premium"
            variant="primary"
            onPress={() => {
              // In-app purchase flow is out of scope for Phase 1
              // Just navigate to a billing view or show a message
            }}
          />
        )}
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
          onPress={() => {
            // Navigation to blocked users list
          }}
        />
      </View>

      {/* Help & Support */}
      <View className="mb-8">
        <Text className="font-semibold text-ink text-lg mb-4">Help & Support</Text>

        <Button
          title="FAQs"
          variant="secondary"
          onPress={() => {
            // Navigation to FAQs
          }}
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
