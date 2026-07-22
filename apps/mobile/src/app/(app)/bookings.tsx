import { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BookingStatus } from '@smartshaadi/types';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useThemeColors } from '../../hooks/useThemeColors';
import { withAlpha } from '../../theme/tokens';
import { formatDate, formatINR } from '../../lib/format';
import { useCancelBooking, useMyBookings } from '../../features/bookings/hooks';
import type { ThemeColors } from '../../theme/tokens';

/** A booking can be cancelled by the customer only while it is still open. */
const CANCELLABLE: ReadonlySet<BookingStatus> = new Set([
  'PENDING',
  'CONFIRMED',
] as BookingStatus[]);

function statusColor(status: BookingStatus, colors: ThemeColors): string {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return colors.success;
    case 'CANCELLED':
    case 'DISPUTED':
      return colors.destructive;
    default:
      return colors.warning;
  }
}

/**
 * My Bookings — reached from More → My Bookings. Lists the signed-in user's
 * vendor bookings newest-event-first, with a cancel action while a booking is
 * still PENDING or CONFIRMED. Confirm/complete are the vendor's actions and are
 * not offered here.
 */
export default function BookingsScreen() {
  const router = useRouter();
  const { colors } = useThemeColors();

  const { data, error, isError, isLoading, refetch } = useMyBookings();
  const cancelBooking = useCancelBooking();

  const handleCancel = useCallback(
    (bookingId: string, vendorName: string) => {
      Alert.alert(
        'Cancel this booking?',
        `Your booking with ${vendorName} will be cancelled. This can’t be undone.`,
        [
          { text: 'Keep booking', style: 'cancel' },
          {
            text: 'Cancel booking',
            style: 'destructive',
            onPress: () => cancelBooking.mutate({ bookingId }),
          },
        ],
      );
    },
    [cancelBooking],
  );

  const backLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="mb-4"
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text className="text-sm" style={{ color: colors.teal }}>
        ← Back
      </Text>
    </Pressable>
  );

  if (isLoading) {
    return (
      <Screen>
        {backLink}
        <LoadingState label="Loading your bookings…" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {backLink}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const bookings = data?.bookings ?? [];

  if (bookings.length === 0) {
    return (
      <Screen>
        {backLink}
        <EmptyState
          title="No bookings yet"
          message="Book a vendor from the Vendors tab and it will show up here."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {backLink}

      <Text className="font-heading text-2xl text-primary mb-6">My Bookings</Text>

      {bookings.map((booking) => (
        <View
          key={booking.id}
          className="bg-surface border border-gold/20 rounded-xl p-4 mb-3"
        >
          <View className="flex-row items-start justify-between">
            <Text className="font-semibold text-ink flex-1 pr-3">
              {booking.vendorName}
            </Text>
            <View
              className="px-2 py-1 rounded-full"
              style={{
                backgroundColor: withAlpha(statusColor(booking.status, colors), '20'),
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: statusColor(booking.status, colors) }}
              >
                {booking.status}
              </Text>
            </View>
          </View>

          {booking.packageName ? (
            <Text className="text-sm text-ink mt-2">{booking.packageName}</Text>
          ) : null}

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs text-muted">
              {formatDate(booking.eventDate) ?? 'Date TBC'}
              {booking.ceremonyType ? ` · ${booking.ceremonyType}` : ''}
            </Text>
            <Text className="text-sm font-semibold text-ink">
              {formatINR(booking.totalAmount)}
            </Text>
          </View>

          {CANCELLABLE.has(booking.status) ? (
            <View className="mt-3">
              <Button
                title="Cancel booking"
                variant="destructive"
                loading={
                  cancelBooking.isPending &&
                  cancelBooking.variables?.bookingId === booking.id
                }
                onPress={() => handleCancel(booking.id, booking.vendorName)}
              />
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}
