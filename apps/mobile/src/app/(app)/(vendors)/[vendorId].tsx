import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { Button } from '../../../components/Button';
import { ErrorState, LoadingState } from '../../../components/States';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { withAlpha } from '../../../theme/tokens';
import { formatDate, formatINR, formatPriceRange } from '../../../lib/format';
import {
  useToggleFavoriteVendor,
  useVendorDetail,
  useVendorReviews,
} from '../../../features/vendors/hooks';

/**
 * Vendor detail — Unit 7.1 (mobile parity).
 *
 * Shows the profile, service list, price band and reviews, and lets a signed-in
 * user favourite the vendor. Contact details (phone/email) are rendered ONLY if
 * the API returned them: the server masks contact info until the relationship
 * warrants it (CLAUDE.md rule 5), so their absence is the normal case, not a
 * loading state to paper over.
 */
export default function VendorDetailScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();
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
  const backLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to vendors"
      onPress={() => router.back()}
      className="mb-4"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text className="text-sm" style={{ color: colors.teal }}>
        ← Vendors
      </Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading vendor…" />
      </Screen>
    );
  }

  if (isError || !vendor) {
    return (
      <Screen>
        {backLink}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const priceBand = formatPriceRange(vendor.priceMin, vendor.priceMax);
  const reviews = reviewData?.reviews ?? [];

  return (
    <Screen scroll>
      {backLink}

      <View className="flex-row items-start justify-between">
        <Text className="font-heading text-2xl text-primary flex-1 pr-3">
          {vendor.businessName}
        </Text>
        {vendor.verified ? (
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: withAlpha(colors.success, '20') }}
          >
            <Text className="text-xs font-semibold" style={{ color: colors.success }}>
              Verified
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="text-sm text-muted mt-1">
        {vendor.city}, {vendor.state}
      </Text>

      {vendor.tagline ? (
        <Text className="text-base text-ink mt-3">{vendor.tagline}</Text>
      ) : null}

      <View className="flex-row items-center justify-between mt-4 py-3 border-y border-gold/20">
        <Text className="text-sm" style={{ color: colors.gold }}>
          {vendor.totalReviews > 0
            ? `★ ${vendor.rating.toFixed(1)} (${vendor.totalReviews} reviews)`
            : 'No reviews yet'}
        </Text>
        <Text className="text-sm font-semibold text-ink">
          {priceBand ?? 'Price on request'}
        </Text>
      </View>

      <View className="mt-4">
        <Button
          title={vendor.isFavorite ? 'Saved' : 'Save vendor'}
          variant={vendor.isFavorite ? 'secondary' : 'primary'}
          loading={toggleFavorite.isPending}
          onPress={handleToggleFavorite}
          accessibilityLabel={
            vendor.isFavorite ? 'Remove from saved vendors' : 'Save this vendor'
          }
        />
      </View>

      {vendor.description ? (
        <View className="mt-6">
          <Text className="font-heading text-lg text-primary mb-2">About</Text>
          <Text className="text-sm text-ink leading-5">{vendor.description}</Text>
        </View>
      ) : null}

      {vendor.services.length > 0 ? (
        <View className="mt-6">
          <Text className="font-heading text-lg text-primary mb-2">Services</Text>
          {vendor.services.map((service) => (
            <View
              key={service.id}
              className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-baseline justify-between">
                <Text className="font-semibold text-ink flex-1 pr-3">
                  {service.name}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: colors.teal }}>
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
            </View>
          ))}
        </View>
      ) : null}

      {vendor.yearsActive != null || vendor.responseTimeHours != null ? (
        <View className="mt-6 flex-row gap-3">
          {vendor.yearsActive != null ? (
            <View className="flex-1 bg-surface border border-gold/20 rounded-xl p-4">
              <Text className="font-heading text-xl text-primary">
                {vendor.yearsActive}
              </Text>
              <Text className="text-xs text-muted mt-1">years active</Text>
            </View>
          ) : null}
          {vendor.responseTimeHours != null ? (
            <View className="flex-1 bg-surface border border-gold/20 rounded-xl p-4">
              <Text className="font-heading text-xl text-primary">
                {vendor.responseTimeHours}h
              </Text>
              <Text className="text-xs text-muted mt-1">avg. response</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {reviews.length > 0 ? (
        <View className="mt-6 mb-4">
          <Text className="font-heading text-lg text-primary mb-2">Reviews</Text>
          {reviews.slice(0, 10).map((review) => (
            <View
              key={review.id}
              className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-ink">{review.reviewerName}</Text>
                <Text className="text-sm" style={{ color: colors.gold }}>
                  ★ {review.rating.toFixed(1)}
                </Text>
              </View>
              {review.title ? (
                <Text className="text-sm font-semibold text-ink mt-2">
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
                <View className="mt-3 pl-3 border-l-2 border-gold/40">
                  <Text className="text-xs font-semibold text-ink">
                    Reply from {vendor.businessName}
                  </Text>
                  <Text className="text-sm text-muted mt-1">{review.vendorReply}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
