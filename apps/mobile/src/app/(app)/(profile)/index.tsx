import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { Avatar } from '../../../components/Avatar';
import { Eyebrow } from '../../../components/Ornament';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState, EmptyState } from '../../../components/States';
import { api } from '../../../lib/api';
import { useSession } from '../../../hooks/useSession';

/** Section wrapper: gold eyebrow + staggered entrance — matches settings.tsx. */
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
      {eyebrow ? <Eyebrow text={eyebrow} className="mb-3" /> : null}
      {children}
    </Animated.View>
  );
}

export default function MyProfileScreen() {
  const router = useRouter();
  const { data: session } = useSession();

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
        <AppHeader title="My Profile" />
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
    return (
      <Screen scroll tabBarInset>
        <AppHeader title="My Profile" />
        <View className="items-center mb-8">
          <Skeleton height={112} circle />
          <Skeleton height={22} width="50%" radius={6} className="mt-4" />
          <Skeleton height={14} width="35%" radius={6} className="mt-2" />
        </View>
        <Card className="p-4 mb-6">
          <Skeleton height={14} width="40%" radius={6} className="mb-3" />
          <Skeleton height={8} radius={4} />
        </Card>
        <Card className="p-0 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className={`px-4 py-3.5 ${i < 2 ? 'border-b border-gold/15' : ''}`}
            >
              <Skeleton height={16} width="45%" radius={6} />
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title="My Profile" />
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
        <AppHeader title="My Profile" />
        <EmptyState
          title="Profile not found"
          message="We couldn't find your profile. Please try again."
        />
      </Screen>
    );
  }

  const completenessPercent = Math.round(profile.profileCompleteness || 0);
  const isVerified = profile.verificationStatus === 'VERIFIED';
  const photoCount = profile.photos?.length ?? 0;
  const primaryPhoto = photoCount > 0 ? profile.photos[0]?.url ?? null : null;

  return (
    <Screen scroll tabBarInset>
      <AppHeader title="My Profile" />

      {/* Identity — avatar, name, verification badge */}
      <Animated.View entering={FadeInUp.duration(300)} className="items-center mb-8">
        <Avatar uri={primaryPhoto} name={profile.name || 'Your Profile'} size="xl" ringed />
        <Text className="font-heading text-2xl text-primary mt-4 mb-1">
          {profile.name || 'Your Profile'}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted text-sm">
            {profile.role ? `${profile.role} • ` : ''}
            {profile.status || 'Active'}
          </Text>
          {isVerified && <Badge label="Verified" variant="successSolid" size="sm" />}
        </View>
      </Animated.View>

      {/* Profile strength */}
      <Section eyebrow="Profile Strength" index={1}>
        <Card elevated>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-ink">Completeness</Text>
            <Text className="font-heading text-lg text-primary">
              {completenessPercent}%
            </Text>
          </View>

          <View className="h-2 bg-gold/20 rounded-full overflow-hidden mb-3">
            <View
              className="h-full bg-gold"
              style={{ width: `${completenessPercent}%` }}
            />
          </View>

          {strengthData?.tips && strengthData.tips.length > 0 && (
            <View className="gap-2 mt-1">
              {strengthData.tips.map((tip, idx) => (
                <Text key={idx} className="text-sm text-ink leading-5">
                  • {tip}
                </Text>
              ))}
            </View>
          )}
        </Card>
      </Section>

      {/* Sections summary */}
      <Section eyebrow="Overview" index={2}>
        <Card className="p-0 overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-gold/15">
            <View>
              <Text className="font-semibold text-ink mb-0.5">Photos</Text>
              <Text className="text-sm text-muted">
                {photoCount} photo{photoCount !== 1 ? 's' : ''}
              </Text>
            </View>
            {photoCount > 0 && <Badge label="Added" variant="tealSoft" size="sm" />}
          </View>

          {profile.premiumTier && (
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <View>
                <Text className="font-semibold text-ink mb-0.5">Subscription</Text>
                <Text className="text-sm text-muted">{profile.premiumTier} tier</Text>
              </View>
              <Badge label="Active" variant="goldSolid" size="sm" />
            </View>
          )}
        </Card>
      </Section>

      {/* Action buttons */}
      <View className="gap-3 mt-2">
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
