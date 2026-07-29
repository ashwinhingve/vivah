import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { BookingStatus } from '@smartshaadi/types';
import { Screen } from '../../components/Screen';
import { AppHeader } from '../../components/AppHeader';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { ActionSheet } from '../../components/ActionSheet';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/States';
import { formatDate, formatINR } from '../../lib/format';
import { useCancelBooking, useMyBookings } from '../../features/bookings/hooks';

/** A booking can be cancelled by the customer only while it is still open. */
const CANCELLABLE: ReadonlySet<BookingStatus> = new Set([
  'PENDING',
  'CONFIRMED',
] as BookingStatus[]);

function statusVariant(status: BookingStatus): BadgeVariant {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
    case 'DISPUTED':
      return 'error';
    default:
      return 'warning';
  }
}

const HEADER = <AppHeader title="My Bookings" showBack />;

/** Booking-card-shaped shimmer for the initial load. */
function SkeletonBookingCard() {
  return (
    <Card className="mb-3">
      <Skeleton height={16} width="55%" radius={6} />
      <Skeleton height={12} width="40%" radius={6} className="mt-2" />
      <Skeleton height={12} width="70%" radius={6} className="mt-2" />
    </Card>
  );
}

/**
 * My Bookings — reached from More → My Bookings. Lists the signed-in user's
 * vendor bookings newest-event-first, with a cancel action while a booking is
 * still PENDING or CONFIRMED. Confirm/complete are the vendor's actions and are
 * not offered here.
 */
export default function BookingsScreen() {
  const { data, error, isError, isLoading, refetch } = useMyBookings();
  const cancelBooking = useCancelBooking();
  const [confirmCancel, setConfirmCancel] = useState<{
    bookingId: string;
    vendorName: string;
  } | null>(null);

  const handleConfirmCancel = useCallback(() => {
    if (confirmCancel) {
      cancelBooking.mutate({ bookingId: confirmCancel.bookingId });
    }
  }, [cancelBooking, confirmCancel]);

  if (isLoading) {
    return (
      <Screen>
        {HEADER}
        <SkeletonBookingCard />
        <SkeletonBookingCard />
        <SkeletonBookingCard />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {HEADER}
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const bookings = data?.bookings ?? [];

  if (bookings.length === 0) {
    return (
      <Screen>
        {HEADER}
        <EmptyState
          title="No bookings yet"
          message="Book a vendor from the Vendors tab and it will show up here."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {HEADER}

      {bookings.map((booking, index) => (
        <Animated.View
          key={booking.id}
          entering={FadeInUp.delay(Math.min(index, 8) * 60).duration(300)}
        >
          <Card className="mb-3">
            <View className="flex-row items-start justify-between">
              <Text className="font-semibold text-ink flex-1 pr-3">
                {booking.vendorName}
              </Text>
              <Badge
                label={booking.status}
                variant={statusVariant(booking.status)}
              />
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
                  onPress={() =>
                    setConfirmCancel({
                      bookingId: booking.id,
                      vendorName: booking.vendorName,
                    })
                  }
                />
              </View>
            ) : null}
          </Card>
        </Animated.View>
      ))}

      <ActionSheet
        visible={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        title="Cancel this booking?"
        message={
          confirmCancel
            ? `Your booking with ${confirmCancel.vendorName} will be cancelled. This can’t be undone.`
            : undefined
        }
        actions={[
          {
            label: 'Cancel booking',
            destructive: true,
            onPress: handleConfirmCancel,
          },
        ]}
        cancelLabel="Keep booking"
      />
    </Screen>
  );
}
