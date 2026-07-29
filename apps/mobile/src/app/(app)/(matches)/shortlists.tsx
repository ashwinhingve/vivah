import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { HeartOff, ImageOff } from 'lucide-react-native';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import {
  EmptyState,
  ErrorState,
} from '../../../components/States';
import { SkeletonRow } from '../../../components/Skeleton';
import { Card } from '../../../components/Card';
import { ActionSheet } from '../../../components/ActionSheet';
import { useToast } from '../../../components/Toast';
import { tokens, withAlpha } from '../../../theme/tokens';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { MEDIA_BASE_URL } from '../../../lib/env';
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
 * Photo-led cards for saved profiles: portrait thumb with gold frame,
 * name/city/compatibility, and a heart-off remove button that confirms
 * through an ActionSheet before un-shortlisting.
 */
const PHOTO_FALLBACK_WASH = [tokens.blush, tokens.background] as const;

export default function ShortlistScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const toast = useToast();
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
  const [removeTarget, setRemoveTarget] = useState<{ profileId: string; name: string } | null>(null);

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
   * Handle removing a profile from shortlist (after sheet confirmation).
   */
  const handleRemove = useCallback(
    async (profileId: string) => {
      try {
        await removeShortlistMutation.mutateAsync(profileId);
        toast.show({ message: 'Removed from shortlist', type: 'info' });
      } catch {
        toast.show({ message: 'Failed to remove from shortlist. Please try again.', type: 'error' });
      }
    },
    [removeShortlistMutation, toast],
  );

  /**
   * Render a shortlisted profile card.
   */
  const renderShortlistCard = useCallback(
    ({ item, index }: { item: typeof items[0]; index: number }) => (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).duration(350)}>
        <Card className="mb-4 p-0 overflow-hidden">
          <Pressable
            onPress={() => router.push(`/(app)/(matches)/${item.profileId}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}'s profile`}
            className="flex-row active:bg-gold/5"
          >
            {/* Photo thumb */}
            <View className="m-3 h-28 w-24 overflow-hidden rounded-xl border border-gold/40 bg-background">
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
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <ImageOff size={20} color={withAlpha(tokens.goldMuted, '99')} strokeWidth={1.5} />
                </LinearGradient>
              )}
            </View>

            {/* Info Section */}
            <View className="flex-1 justify-center py-3 pr-2">
              <Text className="font-heading text-lg text-primary" numberOfLines={1}>
                {item.name}
                {item.age ? `, ${item.age}` : ''}
              </Text>
              <Text className="text-sm text-muted">{item.city}</Text>

              {/* Compatibility */}
              {item.compatibility && (
                <View className="mt-2 flex-row items-center gap-2">
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor: withAlpha(
                        colors[getTierColor(item.compatibility.tier)],
                        '20',
                      ),
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: colors[getTierColor(item.compatibility.tier)] }}
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

            {/* Remove (heart-off) */}
            <Pressable
              onPress={() => setRemoveTarget({ profileId: item.profileId, name: item.name })}
              disabled={removeShortlistMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name} from shortlist`}
              hitSlop={6}
              className="mr-3 h-11 w-11 self-center items-center justify-center rounded-full bg-gold/10 active:bg-gold/20"
            >
              <HeartOff size={18} color={tokens.goldMuted} />
            </Pressable>
          </Pressable>
        </Card>
      </Animated.View>
    ),
    [router, removeShortlistMutation.isPending, colors],
  );

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="Shortlist" showBack />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <AppHeader title="Shortlist" showBack />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <AppHeader title="Shortlist" showBack />
        <EmptyState
          title="No shortlisted profiles"
          message="Save profiles to your shortlist to review them later."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentClassName="px-0 py-0">
      <AppHeader title="Shortlist" showBack className="px-6 pt-4 mb-2" />
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
          paddingTop: 8,
          paddingBottom: 24,
        }}
        scrollIndicatorInsets={{ right: 1 }}
      />

      {/* Remove confirmation */}
      <ActionSheet
        visible={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Remove ${removeTarget.name}?` : undefined}
        message="You can shortlist them again from their profile."
        actions={[
          {
            label: 'Remove from shortlist',
            destructive: true,
            icon: <HeartOff size={20} color={tokens.destructive} />,
            onPress: () => {
              if (removeTarget) void handleRemove(removeTarget.profileId);
            },
          },
        ]}
      />
    </Screen>
  );
}
