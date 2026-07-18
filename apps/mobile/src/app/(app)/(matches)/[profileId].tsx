import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../../components/Screen';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../../components/States';
import { Button } from '../../../components/Button';
import { tokens } from '../../../theme/tokens';
import {
  useProfileDetail,
  useSendMatchRequest,
  useAddShortlist,
  useRemoveShortlist,
  useIsShortlisted,
  useBlockProfile,
  useReportProfile,
} from '../../../features/matches/hooks';
import {
  formatCompatibilityScore,
  getTierColor,
  getTierLabel,
} from '../../../features/matches/utils';

/**
 * Profile Detail Screen — Sprint I Track B.
 *
 * Displays the full profile of a matched user:
 * - Photo carousel (or single photo)
 * - Profile sections (personal, education, profession, etc.)
 * - Compatibility score with detailed breakdown
 * - Action buttons: Send Request, Shortlist, Block, Report
 *
 * Route params: profileId (from the URL)
 */
export default function ProfileDetailScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useProfileDetail(profileId ?? '');

  const { data: shortlistData } = useIsShortlisted(profileId ?? '');

  const sendRequestMutation = useSendMatchRequest();
  const addShortlistMutation = useAddShortlist();
  const removeShortlistMutation = useRemoveShortlist();
  const blockMutation = useBlockProfile();
  const reportMutation = useReportProfile();

  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  if (!profileId) {
    return (
      <Screen>
        <EmptyState
          title="Profile not found"
          message="Unable to load this profile."
        />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading profile..." />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState error={error} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <EmptyState
          title="Profile not found"
          message="This user may have deactivated their account."
        />
      </Screen>
    );
  }

  const isShortlisted = shortlistData?.shortlisted ?? false;

  /**
   * Get the primary photo from the profile photos array.
   */
  const primaryPhoto = profile.photos?.find((p) => p.isPrimary) || profile.photos?.[0];

  /**
   * Handle sending a match request.
   */
  const handleSendRequest = useCallback(async () => {
    try {
      await sendRequestMutation.mutateAsync({
        toProfileId: profileId,
      });
      alert('Request sent!');
    } catch (err) {
      alert('Failed to send request. Please try again.');
    }
  }, [profileId, sendRequestMutation]);

  /**
   * Handle shortlist toggle.
   */
  const handleToggleShortlist = useCallback(async () => {
    try {
      if (isShortlisted) {
        await removeShortlistMutation.mutateAsync(profileId);
      } else {
        await addShortlistMutation.mutateAsync(profileId);
      }
    } catch (err) {
      alert('Failed to update shortlist. Please try again.');
    }
  }, [profileId, isShortlisted, addShortlistMutation, removeShortlistMutation]);

  /**
   * Handle blocking a profile.
   */
  const handleBlock = useCallback(async () => {
    try {
      await blockMutation.mutateAsync(profileId);
      alert('Profile blocked');
      router.back();
    } catch (err) {
      alert('Failed to block profile. Please try again.');
    }
  }, [profileId, blockMutation, router]);

  /**
   * Handle reporting a profile.
   */
  const handleReport = useCallback(
    async (category: string) => {
      try {
        await reportMutation.mutateAsync({
          profileId,
          category,
        });
        alert('Profile reported. Thank you for helping keep our community safe.');
        setShowReportMenu(false);
      } catch (err) {
        alert('Failed to report profile. Please try again.');
      }
    },
    [profileId, reportMutation],
  );

  return (
    <Screen scroll>
      {/* Header: Back Button */}
      <Pressable onPress={() => router.back()} className="mb-4 py-2">
        <Text className="text-teal text-base font-semibold">← Back</Text>
      </Pressable>

      {/* Photo Section */}
      <View className="mb-6 rounded-2xl overflow-hidden bg-background" style={{ minHeight: 320 }}>
        {primaryPhoto?.url ? (
          <Image
            source={{ uri: primaryPhoto.url }}
            className="w-full"
            style={{ height: 320 }}
            resizeMode="cover"
          />
        ) : (
          <View className="h-80 items-center justify-center">
            <Text className="text-muted">Photo not available</Text>
          </View>
        )}
      </View>

      {/* Profile Header: Name, Age, City, Verified */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1">
            <Text className="font-heading text-2xl text-primary">
              {profile.name}
              {profile.personal?.dob ? `, ${calculateAge(profile.personal.dob)}` : ''}
            </Text>
            <Text className="text-muted">
              {profile.location?.city}
            </Text>
          </View>
          {profile.isActive && (
            <View
              className="px-3 py-2 rounded-full"
              style={{ backgroundColor: `${tokens.success}20` }}
            >
              <Text style={{ color: tokens.success }} className="text-xs font-semibold">
                Active
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Note: Compatibility score is fetched separately via useCompatibilityScore */}
      {/* For now, we display available profile sections */}

      {/* Profile Sections */}
      {profile.education?.degree && (
        <ProfileSection
          title="Education"
          content={`${profile.education.degree}${profile.education.fieldOfStudy ? ` in ${profile.education.fieldOfStudy}` : ''}`}
        />
      )}

      {profile.profession?.occupation && (
        <ProfileSection
          title="Profession"
          content={`${profile.profession.occupation}${profile.profession.employer ? ` at ${profile.profession.employer}` : ''}`}
        />
      )}

      {profile.family?.familyType && (
        <ProfileSection
          title="Family"
          content={`${profile.family.familyType}${profile.family.familyValues ? ` • ${profile.family.familyValues}` : ''}`}
        />
      )}

      {profile.lifestyle && (
        <ProfileSection
          title="Lifestyle"
          content={`${profile.lifestyle.diet || 'Diet not specified'} • ${profile.lifestyle.smoking || 'Smoking status not specified'}`}
        />
      )}

      {profile.horoscope?.rashi && (
        <ProfileSection
          title="Horoscope"
          content={`${profile.horoscope.rashi} • Manglik: ${profile.horoscope.manglik || 'Not specified'}`}
        />
      )}

      {profile.aboutMe && (
        <ProfileSection title="About" content={profile.aboutMe} />
      )}

      {/* Action Buttons */}
      <View className="mt-8 mb-6 space-y-3">
        <Button
          title={sendRequestMutation.isPending ? 'Sending...' : 'Send Request'}
          onPress={handleSendRequest}
          loading={sendRequestMutation.isPending}
          variant="primary"
        />

        <Button
          title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
          onPress={handleToggleShortlist}
          loading={
            addShortlistMutation.isPending || removeShortlistMutation.isPending
          }
          variant="secondary"
        />

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setShowActionMenu(!showActionMenu)}
            className="flex-1 h-11 rounded-lg border border-gold/40 items-center justify-center"
          >
            <Text className="text-teal font-semibold">More options</Text>
          </Pressable>
        </View>

        {/* More Options Menu */}
        {showActionMenu && (
          <View className="border border-gold/20 rounded-lg overflow-hidden">
            <Pressable
              onPress={handleBlock}
              disabled={blockMutation.isPending}
              className="px-4 py-3 border-b border-gold/20"
            >
              <Text className="text-destructive font-semibold">
                {blockMutation.isPending ? 'Blocking...' : 'Block Profile'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowReportMenu(!showReportMenu)}
              className="px-4 py-3"
            >
              <Text className="text-destructive font-semibold">Report Profile</Text>
            </Pressable>
          </View>
        )}

        {/* Report Options Menu */}
        {showReportMenu && (
          <View className="border border-gold/20 rounded-lg overflow-hidden">
            {['FAKE_PROFILE', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'SPAM'].map(
              (category) => (
                <Pressable
                  key={category}
                  onPress={() => handleReport(category)}
                  disabled={reportMutation.isPending}
                  className="px-4 py-3 border-b border-gold/20 last:border-b-0"
                >
                  <Text className="text-ink text-sm">
                    {category.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

/**
 * Helper: Calculate age from date of birth.
 */
function calculateAge(dateString: string): number {
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Breakdown Row Component: Renders a single score component.
 */
function BreakdownRow({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const percent = Math.round((score / max) * 100);
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-ink">{label}</Text>
      <View className="flex-row items-center gap-2">
        <View className="h-1.5 flex-1 bg-gold/20 rounded-full w-12">
          <View
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: tokens.gold,
            }}
          />
        </View>
        <Text className="text-xs text-muted w-8 text-right">
          {score}/{max}
        </Text>
      </View>
    </View>
  );
}

/**
 * Profile Section Component: Reusable section header + content.
 */
function ProfileSection({ title, content }: { title: string; content: string }) {
  return (
    <View className="mb-4">
      <Text className="font-heading text-base text-primary mb-2">{title}</Text>
      <Text className="text-ink leading-relaxed">{content}</Text>
    </View>
  );
}
