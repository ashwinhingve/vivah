import { useCallback, useMemo, useState, type ComponentType } from 'react';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  BookOpen,
  Brush,
  Building2,
  Camera,
  Flower2,
  MapPin,
  Music,
  Search,
  Sparkles,
  Star,
  Store,
  UtensilsCrossed,
  type LucideProps,
} from 'lucide-react-native';
import type { VendorCategory } from '@smartshaadi/types';
import type { VendorListParams } from '@smartshaadi/api-client';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import { Input } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import { SkeletonRow } from '../../../components/Skeleton';
import { EmptyState, ErrorState } from '../../../components/States';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { tokens } from '../../../theme/tokens';
import { shadowWarm } from '../../../theme/shadows';
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
const CATEGORY_CHIPS: Array<{
  value: VendorCategory | null;
  label: string;
  icon: ComponentType<LucideProps>;
}> = [
  { value: null, label: 'All', icon: Sparkles },
  { value: 'VENUE', label: 'Venues', icon: Building2 },
  { value: 'PHOTOGRAPHY', label: 'Photography', icon: Camera },
  { value: 'CATERING', label: 'Catering', icon: UtensilsCrossed },
  { value: 'DECORATION', label: 'Decor', icon: Flower2 },
  { value: 'MAKEUP', label: 'Makeup', icon: Brush },
  { value: 'MUSIC', label: 'Music', icon: Music },
  { value: 'PRIEST', label: 'Priest', icon: BookOpen },
];

/** Medallion icon for a vendor's category; Store covers the long tail. */
function categoryIcon(category: string): ComponentType<LucideProps> {
  const chip = CATEGORY_CHIPS.find((c) => c.value === category);
  return chip?.icon ?? Store;
}

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
    ({ item, index }: { item: (typeof vendors)[number]; index: number }) => {
      const priceBand = formatPriceRange(item.priceMin, item.priceMax);
      const IconComponent = categoryIcon(item.category);
      return (
        <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).duration(350)}>
          <Pressable
            testID={`vendor-card-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.businessName}, ${item.city}`}
            onPress={() => router.push(`/(app)/(vendors)/${item.id}`)}
            className="mb-4 rounded-2xl bg-surface border border-gold/20 p-4 active:opacity-90"
            style={shadowWarm}
          >
            <View className="flex-row items-start gap-3">
              {/* Category medallion */}
              <View className="h-12 w-12 items-center justify-center rounded-full bg-gold/15">
                <IconComponent size={22} color={tokens.goldMuted} strokeWidth={1.75} />
              </View>

              <View className="flex-1">
                <Text className="font-heading text-lg text-primary" numberOfLines={1}>
                  {item.businessName}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <MapPin size={12} color={tokens.muted} />
                  <Text className="text-sm text-muted">
                    {item.city}, {item.state}
                  </Text>
                </View>
              </View>

              {item.verified ? <Badge variant="success" label="Verified" size="sm" /> : null}
            </View>

            {item.tagline ? (
              <Text className="text-sm text-muted mt-3" numberOfLines={2}>
                {item.tagline}
              </Text>
            ) : null}

            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gold/15">
              {/* totalReviews guards the rating: a fresh vendor sits at 0, and
                  a 0.0 rating reads as a bad vendor rather than an unrated one. */}
              {item.totalReviews > 0 ? (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color={tokens.gold} fill={tokens.gold} />
                  <Text className="text-sm font-semibold text-gold-muted">
                    {item.rating.toFixed(1)}
                    <Text className="font-normal text-muted"> ({item.totalReviews})</Text>
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-muted">No reviews yet</Text>
              )}
              <Text className="text-sm font-semibold text-teal">
                {priceBand ?? 'Price on request'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [router],
  );

  const header = (
    <View className="mb-4">
      <AppHeader title="Vendors" className="mb-4" />

      <Input
        placeholder="Search vendors, cities…"
        value={searchInput}
        onChangeText={setSearchInput}
        onSubmitEditing={() => setAppliedQuery(searchInput.trim())}
        returnKeyType="search"
        accessibilityLabel="Search vendors"
        containerClassName="mb-3"
        leftIcon={<Search size={18} color={tokens.muted} />}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {CATEGORY_CHIPS.map((chip) => {
          const selected = chip.value === category;
          const ChipIcon = chip.icon;
          return (
            <Pressable
              key={chip.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(chip.value)}
              className={`min-h-11 flex-row items-center gap-1.5 justify-center rounded-full border px-4 ${
                selected ? 'bg-primary border-primary' : 'bg-surface border-gold/40'
              }`}
            >
              <ChipIcon
                size={15}
                color={selected ? tokens.onPrimary : tokens.goldMuted}
              />
              <Text
                className={`text-sm font-semibold ${selected ? 'text-on-primary' : 'text-ink'}`}
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
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
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
    <Screen scroll={false} tabBarInset>
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
