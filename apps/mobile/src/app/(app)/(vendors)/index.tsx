import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { VendorCategory } from '@smartshaadi/types';
import type { VendorListParams } from '@smartshaadi/api-client';
import { Screen } from '../../../components/Screen';
import { Input } from '../../../components/Input';
import { EmptyState, ErrorState, LoadingState } from '../../../components/States';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { withAlpha } from '../../../theme/tokens';
import { formatPriceRange } from '../../../lib/format';
import { useVendorList } from '../../../features/vendors/hooks';

/**
 * Vendor browse — Unit 7.1 (mobile parity).
 *
 * Search + category filter over the public vendor listing, then tap through to
 * detail. Booking is deliberately absent: it needs the availability calendar
 * and a live Razorpay checkout, neither of which exists on mobile.
 *
 * Only the categories users actually browse by are offered as chips. The API
 * accepts 17; showing all 17 in a horizontal scroller is a wall nobody reads.
 */
const CATEGORY_CHIPS: Array<{ value: VendorCategory | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 'VENUE', label: 'Venues' },
  { value: 'PHOTOGRAPHY', label: 'Photography' },
  { value: 'CATERING', label: 'Catering' },
  { value: 'DECORATION', label: 'Decor' },
  { value: 'MAKEUP', label: 'Makeup' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'PRIEST', label: 'Priest' },
];

export default function VendorBrowseScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();

  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [category, setCategory] = useState<VendorCategory | null>(null);

  // Built from the APPLIED query, not the raw input: rebuilding this object on
  // every keystroke would change the query key on every keystroke and fire a
  // request per character.
  const filters = useMemo<VendorListParams>(() => {
    const next: VendorListParams = { sort: 'popular' };
    if (appliedQuery) next.q = appliedQuery;
    if (category) next.category = category;
    return next;
  }, [appliedQuery, category]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useVendorList(filters);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const vendors = useMemo(
    () => data?.pages.flatMap((page) => page.vendors) ?? [],
    [data],
  );

  const renderVendorCard = useCallback(
    ({ item }: { item: (typeof vendors)[number] }) => {
      const priceBand = formatPriceRange(item.priceMin, item.priceMax);
      return (
        <Pressable
          testID={`vendor-card-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.businessName}, ${item.city}`}
          onPress={() => router.push(`/(app)/(vendors)/${item.id}`)}
          className="mb-4 rounded-2xl bg-surface border border-gold/20 p-4 active:opacity-70"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-heading text-lg text-ink">
                {item.businessName}
              </Text>
              <Text className="text-sm text-muted mt-1">
                {item.city}, {item.state}
              </Text>
            </View>
            {item.verified ? (
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: withAlpha(colors.success, '20') }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors.success }}
                >
                  Verified
                </Text>
              </View>
            ) : null}
          </View>

          {item.tagline ? (
            <Text className="text-sm text-muted mt-2" numberOfLines={2}>
              {item.tagline}
            </Text>
          ) : null}

          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gold/20">
            <Text className="text-sm" style={{ color: colors.gold }}>
              {/* totalReviews guards the rating: a fresh vendor sits at 0, and
                  "0.0 ★" reads as a bad vendor rather than an unrated one. */}
              {item.totalReviews > 0
                ? `★ ${item.rating.toFixed(1)} (${item.totalReviews})`
                : 'No reviews yet'}
            </Text>
            <Text className="text-sm font-semibold text-ink">
              {priceBand ?? 'Price on request'}
            </Text>
          </View>
        </Pressable>
      );
    },
    [router, colors],
  );

  const header = (
    <View className="mb-4">
      <Text className="font-heading text-2xl text-primary mb-4">Vendors</Text>

      <Input
        placeholder="Search vendors, cities…"
        value={searchInput}
        onChangeText={setSearchInput}
        onSubmitEditing={() => setAppliedQuery(searchInput.trim())}
        returnKeyType="search"
        accessibilityLabel="Search vendors"
        containerClassName="mb-3"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {CATEGORY_CHIPS.map((chip) => {
          const selected = chip.value === category;
          return (
            <Pressable
              key={chip.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(chip.value)}
              className="px-4 rounded-full border justify-center"
              style={{
                minHeight: 44,
                backgroundColor: selected ? colors.primary : 'transparent',
                borderColor: selected ? colors.primary : withAlpha(colors.gold, '66'),
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: selected ? colors.onPrimary : colors.ink }}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        {header}
        <LoadingState label="Finding vendors…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {header}
        <ErrorState error={error} onRetry={handleRefresh} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={vendors}
        renderItem={renderVendorCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No vendors found"
            message={
              appliedQuery || category
                ? 'Try a different search or category.'
                : 'Vendors will appear here as they join Smart Shaadi.'
            }
            {...(appliedQuery || category
              ? {
                  actionLabel: 'Clear filters',
                  onAction: () => {
                    setSearchInput('');
                    setAppliedQuery('');
                    setCategory(null);
                  },
                }
              : {})}
          />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
      />
    </Screen>
  );
}
