import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Ban,
  Briefcase,
  ChevronLeft,
  EllipsisVertical,
  Flag,
  GraduationCap,
  Heart,
  ImageOff,
  Leaf,
  MapPin,
  MoonStar,
  Quote,
  Users,
  type LucideProps,
} from 'lucide-react-native';
import { Screen } from '../../../components/Screen';
import { EmptyState, ErrorState } from '../../../components/States';
import { Skeleton } from '../../../components/Skeleton';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { GradientScrim } from '../../../components/GradientScrim';
import { ActionSheet } from '../../../components/ActionSheet';
import { useToast } from '../../../components/Toast';
import { tokens, withAlpha } from '../../../theme/tokens';
import { shadowWarmLg } from '../../../theme/shadows';
import {
  useProfileDetail,
  useSendMatchRequest,
  useAddShortlist,
  useRemoveShortlist,
  useIsShortlisted,
  useBlockProfile,
  useReportProfile,
} from '../../../features/matches/hooks';

/**
 * Profile Detail Screen — Sprint I Track B.
 *
 * Full-bleed photo hero with legibility scrim and overlaid name/city,
 * profile sections as warm cards with icon headers, and a sticky bottom
 * action bar (send request · shortlist heart · more menu). Block/report
 * run through ActionSheets; outcomes surface as toasts, never alert().
 *
 * Route params: profileId (from the URL)
 */
const REPORT_CATEGORIES = [
  { code: 'FAKE_PROFILE', label: 'Fake profile' },
  { code: 'HARASSMENT', label: 'Harassment' },
  { code: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { code: 'SPAM', label: 'Spam' },
] as const;

const PHOTO_FALLBACK_WASH = [tokens.blush, tokens.background] as const;

export default function ProfileDetailScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const toast = useToast();

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const isShortlisted = shortlistData?.shortlisted ?? false;

  /**
   * Handle sending a match request.
   */
  const handleSendRequest = useCallback(async () => {
    if (!profileId) return;
    try {
      await sendRequestMutation.mutateAsync({
        toProfileId: profileId,
      });
      toast.show({ message: 'Request sent!', type: 'success' });
    } catch {
      toast.show({ message: 'Failed to send request. Please try again.', type: 'error' });
    }
  }, [profileId, sendRequestMutation, toast]);

  /**
   * Handle shortlist toggle — heart pops, outcome lands as a toast.
   */
  const handleToggleShortlist = useCallback(async () => {
    if (!profileId) return;
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 12, stiffness: 400 }),
      withSpring(1, { damping: 14, stiffness: 300 }),
    );
    void Haptics.selectionAsync();
    try {
      if (isShortlisted) {
        await removeShortlistMutation.mutateAsync(profileId);
        toast.show({ message: 'Removed from shortlist', type: 'info' });
      } else {
        await addShortlistMutation.mutateAsync(profileId);
        toast.show({ message: 'Added to shortlist', type: 'success' });
      }
    } catch {
      toast.show({ message: 'Failed to update shortlist. Please try again.', type: 'error' });
    }
  }, [profileId, isShortlisted, addShortlistMutation, removeShortlistMutation, heartScale, toast]);

  /**
   * Handle blocking a profile (reached via confirm sheet).
   */
  const handleBlock = useCallback(async () => {
    if (!profileId) return;
    try {
      await blockMutation.mutateAsync(profileId);
      toast.show({ message: 'Profile blocked', type: 'success' });
      router.back();
    } catch {
      toast.show({ message: 'Failed to block profile. Please try again.', type: 'error' });
    }
  }, [profileId, blockMutation, router, toast]);

  /**
   * Handle reporting a profile.
   */
  const handleReport = useCallback(
    async (category: string) => {
      if (!profileId) return;
      try {
        await reportMutation.mutateAsync({
          profileId,
          category,
        });
        toast.show({
          message: 'Profile reported. Thank you for helping keep our community safe.',
          type: 'success',
        });
      } catch {
        toast.show({ message: 'Failed to report profile. Please try again.', type: 'error' });
      }
    },
    [profileId, reportMutation, toast],
  );

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
        <Skeleton height={384} radius={16} className="mb-6" />
        <Skeleton height={20} width="55%" radius={6} className="mb-3" />
        <Skeleton height={14} width="35%" radius={6} className="mb-6" />
        <Skeleton height={96} radius={16} className="mb-4" />
        <Skeleton height={96} radius={16} />
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

  /**
   * Get the primary photo from the profile photos array.
   */
  const primaryPhoto = profile.photos?.find((p) => p.isPrimary) || profile.photos?.[0];
  const age = profile.personal?.dob ? calculateAge(profile.personal.dob) : null;

  return (
    <Screen scroll={false} contentClassName="px-0 py-0">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} scrollIndicatorInsets={{ right: 1 }}>
        {/* Photo hero */}
        <View className="h-96 bg-background overflow-hidden">
          {primaryPhoto?.url ? (
            <Image
              source={{ uri: primaryPhoto.url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <LinearGradient
              colors={PHOTO_FALLBACK_WASH}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <ImageOff size={36} color={withAlpha(tokens.goldMuted, '99')} strokeWidth={1.5} />
              <Text className="text-sm text-gold-muted">Photo not available</Text>
            </LinearGradient>
          )}

          <GradientScrim intensity="high" />

          {/* Floating back circle */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute top-4 left-4 h-11 w-11 items-center justify-center rounded-full bg-black/30 active:bg-black/45"
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </Pressable>

          {/* Active badge */}
          {profile.isActive && (
            <View className="absolute top-5 right-4">
              <Badge variant="successSolid" label="Active" size="sm" />
            </View>
          )}

          {/* Name + city overlay */}
          <View className="absolute bottom-5 left-6 right-6">
            <Text className="font-heading text-3xl text-white" numberOfLines={2}>
              {profile.name}
              {age ? `, ${age}` : ''}
            </Text>
            {profile.location?.city ? (
              <View className="mt-1.5 flex-row items-center gap-1">
                <MapPin size={13} color="rgba(255,255,255,0.85)" />
                <Text className="text-base text-white/85">{profile.location.city}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Profile sections */}
        <View className="px-6 pt-6">
          {profile.education?.degree && (
            <ProfileSection
              icon={GraduationCap}
              title="Education"
              content={`${profile.education.degree}${profile.education.fieldOfStudy ? ` in ${profile.education.fieldOfStudy}` : ''}`}
              index={0}
            />
          )}

          {profile.profession?.occupation && (
            <ProfileSection
              icon={Briefcase}
              title="Profession"
              content={`${profile.profession.occupation}${profile.profession.employer ? ` at ${profile.profession.employer}` : ''}`}
              index={1}
            />
          )}

          {profile.family?.familyType && (
            <ProfileSection
              icon={Users}
              title="Family"
              content={`${profile.family.familyType}${profile.family.familyValues ? ` • ${profile.family.familyValues}` : ''}`}
              index={2}
            />
          )}

          {profile.lifestyle && (
            <ProfileSection
              icon={Leaf}
              title="Lifestyle"
              content={`${profile.lifestyle.diet || 'Diet not specified'} • ${profile.lifestyle.smoking || 'Smoking status not specified'}`}
              index={3}
            />
          )}

          {profile.horoscope?.rashi && (
            <ProfileSection
              icon={MoonStar}
              title="Horoscope"
              content={`${profile.horoscope.rashi} • Manglik: ${profile.horoscope.manglik || 'Not specified'}`}
              index={4}
            />
          )}

          {profile.aboutMe && (
            <ProfileSection icon={Quote} title="About" content={profile.aboutMe} index={5} />
          )}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        className="flex-row items-center gap-3 border-t border-gold/20 bg-surface px-5 pt-3 pb-4"
        style={shadowWarmLg}
      >
        <View className="flex-1">
          <Button
            title="Send Request"
            onPress={handleSendRequest}
            loading={sendRequestMutation.isPending}
            variant="primary"
          />
        </View>
        <Animated.View style={heartStyle}>
          <Pressable
            onPress={handleToggleShortlist}
            disabled={addShortlistMutation.isPending || removeShortlistMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={isShortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            accessibilityState={{ selected: isShortlisted }}
            className={`h-12 w-12 items-center justify-center rounded-full border ${
              isShortlisted ? 'border-primary bg-primary/10' : 'border-gold/40 bg-surface'
            } active:bg-gold/10`}
          >
            <Heart
              size={22}
              color={tokens.primary}
              fill={isShortlisted ? tokens.primary : 'transparent'}
            />
          </Pressable>
        </Animated.View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          className="h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-surface active:bg-gold/10"
        >
          <EllipsisVertical size={22} color={tokens.goldMuted} />
        </Pressable>
      </View>

      {/* More options */}
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="More options"
        actions={[
          {
            label: 'Block profile',
            destructive: true,
            icon: <Ban size={20} color={tokens.destructive} />,
            onPress: () => setConfirmBlockOpen(true),
          },
          {
            label: 'Report profile',
            destructive: true,
            icon: <Flag size={20} color={tokens.destructive} />,
            onPress: () => setReportOpen(true),
          },
        ]}
      />

      {/* Block confirmation */}
      <ActionSheet
        visible={confirmBlockOpen}
        onClose={() => setConfirmBlockOpen(false)}
        title="Block this profile?"
        message="They won't be able to see your profile or contact you. This can be undone from Settings → Blocked users."
        actions={[
          {
            label: 'Block profile',
            destructive: true,
            icon: <Ban size={20} color={tokens.destructive} />,
            onPress: () => void handleBlock(),
          },
        ]}
      />

      {/* Report categories */}
      <ActionSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report profile"
        message="Why are you reporting this profile?"
        actions={REPORT_CATEGORIES.map((category) => ({
          label: category.label,
          onPress: () => void handleReport(category.code),
        }))}
      />
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
 * Profile Section: warm card with an icon-in-gold-circle header.
 */
function ProfileSection({
  icon: IconComponent,
  title,
  content,
  index,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  content: ReactNode;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(400)}>
      <Card className="mb-4 p-5">
        <View className="mb-2 flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-gold/15">
            <IconComponent size={18} color={tokens.goldMuted} />
          </View>
          <Text className="font-heading text-base text-primary">{title}</Text>
        </View>
        <Text className="text-ink leading-relaxed">{content}</Text>
      </Card>
    </Animated.View>
  );
}
