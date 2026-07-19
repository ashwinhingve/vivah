import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
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
  useShortlistFeed,
  useRemoveShortlist,
} from '../../../features/matches/hooks';
import {
  formatCompatibilityScore,
  getTierColor,
  getTierLabel,
} from '../../../features/matches/utils';

/**
 * Shortlist Screen — Sprint I Track B.
 *
 * Displays a paginated list of shortlisted profiles.
 * Each card shows the profile photo, name, age, city, compatibility score,
 * and a remove button to un-shortlist.
 *
 * Pagination: scroll to the bottom to load more.
 */
export default function ShortlistScreen() {
  const router = useRouter();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useShortlistFeed();

  const removeShortlistMutation = useRemoveShortlist();

  /**
   * Flatten paginated data into a single list.
   */
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  /**
   * Handle reaching the end of the list.
   */
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Handle removing a profile from shortlist.
   */
  const handleRemove = useCallback(
    async (profileId: string) => {
      try {
        await removeShortlistMutation.mutateAsync(profileId);
      } catch (err) {
        alert('Failed to remove from shortlist. Please try again.');
      }
    },
    [removeShortlistMutation],
  );

  /**
   * Render a shortlisted profile card.
   */
  const renderShortlistCard = useCallback(
    ({ item }: { item: typeof items[0] }) => (
      <View className="mb-4 rounded-2xl bg-surface overflow-hidden">
        {/* Tap to view detail */}
        <Pressable
          onPress={() => router.push(`/(app)/(matches)/${item.profileId}`)}
          className="flex-row"
        >
          {/* Photo */}
          <View className="w-20 h-20 bg-background">
            {item.photoKey && !item.photoHidden ? (
              <Image
                source={{
                  uri: `https://media.smartshaadi.co.in/${item.photoKey}`,
                }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Text className="text-xs text-muted">No photo</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View className="flex-1 p-3 justify-center">
            <Text className="font-heading text-base text-ink">
              {item.name}
              {item.age ? `, ${item.age}` : ''}
            </Text>
            <Text className="text-sm text-muted">{item.city}</Text>

            {/* Compatibility Badge */}
            {item.compatibility && (
              <View className="mt-2 flex-row items-center gap-2">
                <View
                  className="px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: `${getTierColor(item.compatibility.tier)}20`,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: getTierColor(item.compatibility.tier) }}
                  >
                    {formatCompatibilityScore(item.compatibility.totalScore)}
                  </Text>
                </View>
                <Text className="text-xs text-muted">
                  {getTierLabel(item.compatibility.tier)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* Remove Button */}
        <View className="px-3 py-2 border-t border-gold/20">
          <Button
            title={
              removeShortlistMutation.isPending ? 'Removing...' : 'Remove from Shortlist'
            }
            onPress={() => handleRemove(item.profileId)}
            loading={removeShortlistMutation.isPending}
            variant="secondary"
          />
        </View>
      </View>
    ),
    [router, removeShortlistMutation.isPending, handleRemove],
  );

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading your shortlist..." />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No shortlisted profiles"
          message="Save profiles to your shortlist to review them later."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        renderItem={renderShortlistCard}
        keyExtractor={(item) => item.profileId}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
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
    </Screen>
  );
}
