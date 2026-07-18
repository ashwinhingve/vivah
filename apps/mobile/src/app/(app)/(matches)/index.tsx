import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../components/Screen';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  describeError,
} from '../../../components/States';
import { tokens } from '../../../theme/tokens';
import { useMatchFeed } from '../../../features/matches/hooks';
import {
  formatCompatibilityScore,
  getTierColor,
  getTierLabel,
} from '../../../features/matches/utils';

/**
 * Match Feed Screen — Sprint I Track B.
 *
 * Displays a paginated feed of match profiles as tap-based cards.
 * Each card shows: photo, name, age, city, and compatibility score.
 * Pull-to-refresh re-fetches the first page; scrolling to the bottom
 * auto-loads the next page.
 *
 * TAP to navigate to the profile detail screen.
 * SCROLL DOWN to load more matches.
 * PULL DOWN to refresh the entire feed.
 */
export default function MatchFeedScreen() {
  const router = useRouter();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
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
    ({ item }: { item: typeof items[0] }) => (
      <Pressable
        onPress={() => router.push(`/(app)/(matches)/${item.profileId}`)}
        className="mb-4 rounded-2xl bg-surface overflow-hidden"
        style={{ minHeight: 320 }}
      >
        {/* Photo Container */}
        <View className="h-48 bg-background overflow-hidden">
          {item.photoKey && !item.photoHidden ? (
            <Image
              source={{ uri: `https://media.smartshaadi.co.in/${item.photoKey}` }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <Text className="text-muted">Photo hidden</Text>
            </View>
          )}

          {/* Verified Badge (top-right) */}
          {item.isVerified && (
            <View
              className="absolute top-3 right-3 bg-success px-2 py-1 rounded-full"
              style={{ backgroundColor: tokens.success }}
            >
              <Text className="text-white text-xs font-semibold">Verified</Text>
            </View>
          )}

          {/* New Badge (top-left) */}
          {item.isNew && (
            <View
              className="absolute top-3 left-3 bg-primary px-2 py-1 rounded-full"
              style={{ backgroundColor: tokens.primary }}
            >
              <Text className="text-white text-xs font-semibold">New</Text>
            </View>
          )}
        </View>

        {/* Card Info Section */}
        <View className="p-4">
          {/* Name, Age, City */}
          <View className="mb-3">
            <View className="flex-row items-baseline justify-between mb-1">
              <Text className="font-heading text-lg text-ink">
                {item.name}
                {item.age ? `, ${item.age}` : ''}
              </Text>
            </View>
            <Text className="text-sm text-muted">{item.city}</Text>
          </View>

          {/* Compatibility Score Badge */}
          <View className="flex-row items-center justify-between pt-3 border-t border-gold/20">
            <Text className="text-xs text-muted">Compatibility</Text>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: `${getTierColor(item.compatibility.tier)}20` }}
            >
              <Text
                className="font-semibold text-sm"
                style={{ color: getTierColor(item.compatibility.tier) }}
              >
                {formatCompatibilityScore(item.compatibility.totalScore)}
              </Text>
            </View>
          </View>

          {/* Tier Label */}
          <Text className="text-xs text-muted mt-2">
            {getTierLabel(item.compatibility.tier)}
          </Text>
        </View>

        {/* Tap Indicator */}
        <View className="px-4 pb-3">
          <Text className="text-xs text-teal text-center">Tap to view profile</Text>
        </View>
      </Pressable>
    ),
    [router],
  );

  /**
   * Loading state: spinner while fetching the first page.
   */
  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Finding your perfect match..." />
      </Screen>
    );
  }

  /**
   * Error state: allow retry.
   */
  if (isError) {
    return (
      <Screen>
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
   * Happy path: render the infinite list with pull-to-refresh.
   */
  return (
    <Screen scroll={false}>
      <View className="flex-1 px-0 py-0">
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
            paddingVertical: 16,
          }}
          scrollIndicatorInsets={{ right: 1 }}
        />
      </View>
    </Screen>
  );
}
