import { useRouter } from 'expo-router';
import { Text, View, ScrollView, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../../../components/Screen';
import { Button } from '../../../components/Button';
import { LoadingState, ErrorState, EmptyState } from '../../../components/States';
import { api } from '../../../lib/api';
import { useSession } from '../../../hooks/useSession';

export default function MyProfileScreen() {
  const router = useRouter();
  const { data: session } = useSession();

  // Fetch profile metadata
  const {
    data: profile,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ['profile-me'],
    queryFn: () => api.profiles.getMe(),
    enabled: !!session,
  });

  // Fetch profile strength tips
  const {
    data: strengthData,
    isLoading: strengthLoading,
    error: strengthError,
    refetch: refetchStrength,
  } = useQuery({
    queryKey: ['profile-strength'],
    queryFn: () => api.profiles.getStrengthTips(),
    enabled: !!session,
  });

  if (!session) {
    return (
      <Screen>
        <EmptyState
          title="Please sign in"
          message="You need to be signed in to view your profile."
        />
      </Screen>
    );
  }

  const isLoading = metaLoading || strengthLoading;
  const error = metaError || strengthError;

  if (isLoading) {
    return <LoadingState label="Loading your profile..." />;
  }

  if (error) {
    return (
      <Screen>
        <ErrorState
          error={error}
          onRetry={() => {
            refetchMeta();
            refetchStrength();
          }}
        />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <EmptyState
          title="Profile not found"
          message="We couldn't find your profile. Please try again."
        />
      </Screen>
    );
  }

  const completenessPercent = Math.round(profile.profileCompleteness || 0);

  return (
    <Screen scroll>
      {/* Profile header */}
      <View className="mb-6">
        {profile.photos && profile.photos.length > 0 && (
          <View className="mb-4">
            <Image
              source={{ uri: profile.photos[0].url || '' }}
              style={{ width: '100%', height: 300 }}
              className="rounded-2xl"
            />
          </View>
        )}

        <Text className="font-heading text-2xl text-primary mb-1">
          {profile.name || 'Your Profile'}
        </Text>
        <Text className="text-muted text-sm">
          {profile.role ? `${profile.role} • ` : ''}
          {profile.status || 'Active'}
        </Text>
      </View>

      {/* Profile strength card */}
      <View className="bg-gold/10 border border-gold/40 rounded-xl p-4 mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-semibold text-ink">Profile Strength</Text>
          <Text className="font-heading text-lg text-primary">
            {completenessPercent}%
          </Text>
        </View>

        {/* Progress bar */}
        <View className="h-2 bg-gold/20 rounded-full overflow-hidden mb-3">
          <View
            className="h-full bg-gold"
            style={{ width: `${completenessPercent}%` }}
          />
        </View>

        {/* Tips */}
        {strengthData?.tips && strengthData.tips.length > 0 && (
          <View className="gap-2">
            {strengthData.tips.map((tip, idx) => (
              <Text key={idx} className="text-sm text-ink leading-5">
                • {tip}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Profile sections summary */}
      {profile.photos && (
        <View className="bg-surface border border-gold/20 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-ink mb-1">Photos</Text>
              <Text className="text-sm text-muted">
                {profile.photos.length} photo{profile.photos.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View className="text-teal">
              <Text className="text-sm font-semibold">✓</Text>
            </View>
          </View>
        </View>
      )}

      {/* Subscription info */}
      {profile.premiumTier && (
        <View className="bg-gold/10 border border-gold/40 rounded-xl p-4 mb-6">
          <Text className="font-semibold text-ink mb-2">Subscription</Text>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-success mr-2" />
            <Text className="text-sm text-ink">
              {profile.premiumTier} tier
            </Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View className="gap-3 mt-6">
        <Button
          title="Edit Profile"
          variant="primary"
          onPress={() => router.push('/(app)/(profile)/edit')}
        />
        <Button
          title="Complete Onboarding"
          variant="secondary"
          onPress={() => router.push('/(app)/(profile)/onboarding/basics')}
        />
        <Button
          title="Settings"
          variant="secondary"
          onPress={() => router.push('/(app)/settings')}
        />
      </View>
    </Screen>
  );
}
