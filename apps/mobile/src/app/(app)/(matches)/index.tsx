import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BadgeCheck, Bookmark, ChevronRight, ImageOff, MapPin, UserRoundPlus } from 'lucide-react-native';
import { Screen } from '../../../components/Screen';
import { AppHeader, HeaderIconButton } from '../../../components/AppHeader';
import { GradientScrim } from '../../../components/GradientScrim';
import { Badge } from '../../../components/Badge';
import { SkeletonFeedCard } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { tokens, withAlpha } from '../../../theme/tokens';
import { shadowWarm } from '../../../theme/shadows';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { MEDIA_BASE_URL } from '../../../lib/env';
import { useMatchFeed } from '../../../features/matches/hooks';
import {
  formatCompatibilityScore,
  getTierColor,
  getTierLabel,
} from '../../../features/matches/utils';

/**
 * Match Feed Screen — Sprint I Track B.
 *
 * Photo-led premium cards (web MatchCard parity): tall portrait with a
 * legibility scrim and gold inner frame, name/age in Playfair overlaid on
 * the photo, color-coded compatibility pill, verified check. Pull-to-refresh
 * re-fetches the first page; scrolling to the bottom auto-loads the next.
 */
const CARD_STAGGER_MS = 60;
const CARD_STAGGER_CAP = 6;
/** Clears the floating pill tab bar (list content scrolls beneath it). */
const TAB_BAR_CLEARANCE = 112;

const PHOTO_FALLBACK_WASH = [tokens.blush, tokens.background] as const;

export default function MatchFeedScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useMatchFeed();

  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Handle pull-to-refresh by refetching the first page.
   * setIsRefreshing tracks the visual refresh indicator separately.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  /**
   * When screen regains focus, check if data is stale (older than 5 min).
   * If so, silently refetch in the background.
   */
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  /**
   * Handle reaching the end of the list to load the next page.
   */
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Flatten paginated data into a single list of feed items.
   */
  const items =
    data?.pages.flatMap((page) => page.items) ?? [];

  /**
   * Render a single match card — tappable to navigate to detail.
   */
  const renderMatchCard = useCallback(
    ({ item, index }: { item: typeof items[0]; index: number }) => {
      const tierColor = colors[getTierColor(item.compatibility.tier)];
      return (
        <Animated.View
          entering={FadeInUp.delay(Math.min(index, CARD_STAGGER_CAP) * CARD_STAGGER_MS)
            .springify()
            .damping(18)}
        >
          <Pressable
            onPress={() => router.push(`/(app)/(matches)/${item.profileId}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}'s profile`}
            className="mb-5 rounded-2xl border border-gold/20 bg-surface overflow-hidden active:opacity-90"
            style={shadowWarm}
          >
            {/* Photo with scrim + gold inner frame */}
            <View className="h-72 bg-background overflow-hidden">
              {item.photoKey && !item.photoHidden ? (
                <Image
                  source={{ uri: `${MEDIA_BASE_URL}/${item.photoKey}` }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <LinearGradient
                  colors={PHOTO_FALLBACK_WASH}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <ImageOff size={32} color={withAlpha(tokens.goldMuted, '99')} strokeWidth={1.5} />
                  <Text className="text-sm text-gold-muted">Photo hidden</Text>
                </LinearGradient>
              )}

              <GradientScrim intensity="high" />

              {/* Gold inner frame (web: ring-2 ring-inset ring-gold/70) */}
              <View
                pointerEvents="none"
                className="absolute inset-0 m-2.5 rounded-xl border border-gold/70"
              />

              {/* Compatibility pill + New (top-left) */}
              <View className="absolute top-4 left-4 flex-row items-center gap-2">
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: tierColor }}
                >
                  <Text className="text-xs font-bold text-white">
                    {formatCompatibilityScore(item.compatibility.totalScore)}
                  </Text>
                </View>
                {item.isNew && <Badge variant="goldSolid" label="New" size="sm" />}
              </View>

              {/* Verified check (top-right) */}
              {item.isVerified && (
                <View
                  className="absolute top-4 right-4 h-7 w-7 items-center justify-center rounded-full bg-success"
                  accessibilityLabel="Verified profile"
                >
                  <BadgeCheck size={16} color={tokens.onPrimary} />
                </View>
              )}

              {/* Name + city overlaid on the scrim */}
              <View className="absolute bottom-4 left-5 right-5">
                <Text className="font-heading text-2xl text-white" numberOfLines={1}>
                  {item.name}
                  {item.age ? `, ${item.age}` : ''}
                </Text>
                {item.city ? (
                  <View className="mt-1 flex-row items-center gap-1">
                    <MapPin size={12} color="rgba(255,255,255,0.85)" />
                    <Text className="text-sm text-white/85">{item.city}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Footer */}
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-xs text-muted">
                {getTierLabel(item.compatibility.tier)}
              </Text>
              <View className="flex-row items-center gap-0.5">
                <Text className="text-xs font-semibold text-teal">View profile</Text>
                <ChevronRight size={14} color={tokens.teal} />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [router, colors],
  );

  /**
   * Loading state: warm shimmer skeleton cards while fetching the first page.
   */
  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="Matches" />
        <SkeletonFeedCard />
        <SkeletonFeedCard />
        <SkeletonFeedCard />
      </Screen>
    );
  }

  /**
   * Error state: allow retry.
   */
  if (isError) {
    return (
      <Screen>
        <AppHeader title="Matches" />
        <ErrorState error={error} onRetry={handleRefresh} />
      </Screen>
    );
  }

  /**
   * Empty state: no matches available yet.
   */
  if (items.length === 0) {
    return (
      <Screen>
        <AppHeader title="Matches" />
        <EmptyState
          title="No matches yet"
          message="Check back later for new matches tailored to your preferences."
          actionLabel="Refresh"
          onAction={handleRefresh}
        />
      </Screen>
    );
  }

  /**
   * Happy path: fixed header, list scrolls beneath the floating tab bar.
   */
  return (
    <Screen scroll={false} contentClassName="px-0 py-0">
      <AppHeader
        title="Matches"
        className="px-6 pt-4 mb-2"
        right={
          <View className="flex-row gap-2">
            <HeaderIconButton
              icon={<UserRoundPlus size={20} color={tokens.primary} />}
              accessibilityLabel="Match requests"
              onPress={() => router.push('/(app)/(matches)/requests')}
            />
            <HeaderIconButton
              icon={<Bookmark size={20} color={tokens.primary} />}
              accessibilityLabel="Shortlisted profiles"
              onPress={() => router.push('/(app)/(matches)/shortlists')}
            />
          </View>
        }
      />
      <FlatList
        data={items}
        renderItem={renderMatchCard}
        keyExtractor={(item) => item.profileId}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.primary}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator size="small" color={tokens.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: TAB_BAR_CLEARANCE,
        }}
        scrollIndicatorInsets={{ right: 1 }}
      />
    </Screen>
  );
}
