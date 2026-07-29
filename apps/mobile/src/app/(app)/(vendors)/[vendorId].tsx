import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  BookOpen,
  Brush,
  Building2,
  Camera,
  ChevronLeft,
  Flower2,
  MapPin,
  Music,
  Star,
  Store,
  UtensilsCrossed,
  type LucideProps,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Screen } from '../../../components/Screen';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { Avatar } from '../../../components/Avatar';
import { Eyebrow } from '../../../components/Ornament';
import { Skeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/States';
import { tokens } from '../../../theme/tokens';
import { shadowWarmLg } from '../../../theme/shadows';
import { formatDate, formatINR, formatPriceRange } from '../../../lib/format';
import {
  useToggleFavoriteVendor,
  useVendorDetail,
  useVendorReviews,
} from '../../../features/vendors/hooks';

/**
 * Vendor detail — Unit 7.1 (mobile parity).
 *
 * Blush gradient header band with category medallion, gold eyebrow section
 * headers, service package cards, stat tiles, reviews with initials avatars,
 * and a sticky bottom bar (request booking / save). Contact details
 * (phone/email) are rendered ONLY if the API returned them: the server masks
 * contact info until the relationship warrants it (CLAUDE.md rule 5), so their
 * absence is the normal case, not a loading state to paper over.
 */
const CATEGORY_ICONS: Record<string, ComponentType<LucideProps>> = {
  VENUE: Building2,
  PHOTOGRAPHY: Camera,
  CATERING: UtensilsCrossed,
  DECORATION: Flower2,
  MAKEUP: Brush,
  MUSIC: Music,
  PRIEST: BookOpen,
};

const BAND_WASH = [tokens.blush, tokens.background] as const;

export default function VendorDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vendorId: string }>();
  const vendorId = params.vendorId ?? '';

  const { data: vendor, error, isError, isLoading, refetch } = useVendorDetail(vendorId);
  const { data: reviewData } = useVendorReviews(vendorId);
  const toggleFavorite = useToggleFavoriteVendor();

  const handleToggleFavorite = useCallback(() => {
    if (vendorId) toggleFavorite.mutate(vendorId);
  }, [toggleFavorite, vendorId]);

  // Rendered in every state. This is a PUSHED route with no tab bar behind it,
  // so an error branch that returns a bare <ErrorState> strands the user with
  // no way back other than the OS gesture.
  const backCircle = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to vendors"
      onPress={() => router.back()}
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-full bg-gold/10 active:bg-gold/20"
    >
      <ChevronLeft size={24} color={tokens.primary} />
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backCircle}
        <View className="mt-6">
          <Skeleton height={28} width="65%" radius={8} className="mb-3" />
          <Skeleton height={14} width="40%" radius={6} className="mb-6" />
          <Skeleton height={90} radius={16} className="mb-4" />
          <Skeleton height={90} radius={16} />
        </View>
      </Screen>
    );
  }

  if (isError || !vendor) {
    return (
      <Screen>
        {backCircle}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const priceBand = formatPriceRange(vendor.priceMin, vendor.priceMax);
  const reviews = reviewData?.reviews ?? [];
  const CategoryIcon = CATEGORY_ICONS[vendor.category] ?? Store;

  return (
    <Screen scroll={false} contentClassName="px-0 py-0">
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} scrollIndicatorInsets={{ right: 1 }}>
        {/* Gradient header band */}
        <View className="overflow-hidden pb-6">
          <LinearGradient
            colors={BAND_WASH}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View className="px-6 pt-4">
            {backCircle}

            <Animated.View entering={FadeInDown.duration(350)} className="mt-4 flex-row items-start gap-4">
              <View className="h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-surface">
                <CategoryIcon size={28} color={tokens.goldMuted} strokeWidth={1.5} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="font-heading text-2xl text-primary flex-1">
                    {vendor.businessName}
                  </Text>
                  {vendor.verified ? <Badge variant="successSolid" label="Verified" size="sm" /> : null}
                </View>
                <View className="mt-1 flex-row items-center gap-1">
                  <MapPin size={13} color={tokens.muted} />
                  <Text className="text-sm text-muted">
                    {vendor.city}, {vendor.state}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {vendor.tagline ? (
              <Text className="text-base text-ink mt-4">{vendor.tagline}</Text>
            ) : null}

            {/* Rating + price band */}
            <View className="mt-4 flex-row items-center justify-between rounded-xl border border-gold/30 bg-surface px-4 py-3">
              {vendor.totalReviews > 0 ? (
                <View className="flex-row items-center gap-1.5">
                  <Star size={15} color={tokens.gold} fill={tokens.gold} />
                  <Text className="text-sm font-semibold text-gold-muted">
                    {vendor.rating.toFixed(1)}
                    <Text className="font-normal text-muted"> ({vendor.totalReviews} reviews)</Text>
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-muted">No reviews yet</Text>
              )}
              <Text className="text-sm font-semibold text-teal">
                {priceBand ?? 'Price on request'}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          {vendor.description ? (
            <View className="mb-6">
              <Eyebrow text="About" className="mb-3" />
              <Text className="text-sm text-ink leading-6">{vendor.description}</Text>
            </View>
          ) : null}

          {vendor.services.length > 0 ? (
            <View className="mb-6">
              <Eyebrow text="Packages" className="mb-3" />
              {vendor.services.map((service, index) => (
                <Animated.View
                  key={service.id}
                  entering={FadeInDown.delay(Math.min(index, 5) * 60).duration(350)}
                >
                  <Card className="mb-3 p-4">
                    <View className="flex-row items-baseline justify-between">
                      <Text className="font-semibold text-ink flex-1 pr-3">
                        {service.name}
                      </Text>
                      <Text className="text-sm font-semibold text-teal">
                        {formatINR(service.priceFrom)}
                        {service.priceTo != null && service.priceTo !== service.priceFrom
                          ? ` – ${formatINR(service.priceTo)}`
                          : ''}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted mt-1">per {service.unit}</Text>
                    {service.description ? (
                      <Text className="text-sm text-muted mt-2">{service.description}</Text>
                    ) : null}
                  </Card>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {vendor.yearsActive != null || vendor.responseTimeHours != null ? (
            <View className="mb-6 flex-row gap-3">
              {vendor.yearsActive != null ? (
                <Card className="flex-1 items-center p-4">
                  <Text className="font-heading-bold text-2xl text-primary">
                    {vendor.yearsActive}
                  </Text>
                  <Text className="text-xs text-muted mt-1">years active</Text>
                </Card>
              ) : null}
              {vendor.responseTimeHours != null ? (
                <Card className="flex-1 items-center p-4">
                  <Text className="font-heading-bold text-2xl text-primary">
                    {vendor.responseTimeHours}h
                  </Text>
                  <Text className="text-xs text-muted mt-1">avg. response</Text>
                </Card>
              ) : null}
            </View>
          ) : null}

          {reviews.length > 0 ? (
            <View className="mb-4">
              <Eyebrow text="Reviews" className="mb-3" />
              {reviews.slice(0, 10).map((review, index) => (
                <Animated.View
                  key={review.id}
                  entering={FadeInDown.delay(Math.min(index, 5) * 60).duration(350)}
                >
                  <Card className="mb-3 p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2.5">
                        <Avatar name={review.reviewerName} size="sm" />
                        <Text className="font-semibold text-ink">{review.reviewerName}</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Star size={13} color={tokens.gold} fill={tokens.gold} />
                        <Text className="text-sm font-semibold text-gold-muted">
                          {review.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                    {review.title ? (
                      <Text className="text-sm font-semibold text-ink mt-3">
                        {review.title}
                      </Text>
                    ) : null}
                    {review.comment ? (
                      <Text className="text-sm text-muted mt-1">{review.comment}</Text>
                    ) : null}
                    {formatDate(review.createdAt) ? (
                      <Text className="text-xs text-muted mt-2">
                        {formatDate(review.createdAt)}
                      </Text>
                    ) : null}
                    {review.vendorReply ? (
                      <View className="mt-3 rounded-r-lg border-l-2 border-gold bg-blush/60 p-3">
                        <Text className="text-xs font-semibold text-ink">
                          Reply from {vendor.businessName}
                        </Text>
                        <Text className="text-sm text-muted mt-1">{review.vendorReply}</Text>
                      </View>
                    ) : null}
                  </Card>
                </Animated.View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <View
        className="flex-row items-center gap-3 border-t border-gold/20 bg-surface px-5 pt-3 pb-4"
        style={shadowWarmLg}
      >
        {vendor.services.length > 0 ? (
          <View className="flex-1">
            <Button
              title="Request Booking"
              variant="primary"
              onPress={() => router.push(`/(app)/booking/${vendorId}`)}
              accessibilityLabel={`Request a booking with ${vendor.businessName}`}
            />
          </View>
        ) : null}
        <View className={vendor.services.length > 0 ? '' : 'flex-1'}>
          <Button
            title={vendor.isFavorite ? 'Saved' : 'Save vendor'}
            variant={
              vendor.isFavorite || vendor.services.length > 0
                ? 'secondary'
                : 'primary'
            }
            loading={toggleFavorite.isPending}
            onPress={handleToggleFavorite}
            accessibilityLabel={
              vendor.isFavorite ? 'Remove from saved vendors' : 'Save this vendor'
            }
          />
        </View>
      </View>
    </Screen>
  );
}
