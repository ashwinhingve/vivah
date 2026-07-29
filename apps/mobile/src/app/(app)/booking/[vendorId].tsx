import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CreateBookingSchema } from '@smartshaadi/schemas';
import { Screen } from '../../../components/Screen';
import { AppHeader } from '../../../components/AppHeader';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Input } from '../../../components/Input';
import { Eyebrow } from '../../../components/Ornament';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { describeError, EmptyState, ErrorState } from '../../../components/States';
import { shadowWarm } from '../../../theme/shadows';
import { formatDate, formatINR } from '../../../lib/format';
import {
  useVendorAvailability,
  useVendorDetail,
} from '../../../features/vendors/hooks';
import { useCreateBooking } from '../../../features/bookings/hooks';

/** `YYYY-MM-DD` in local time — matching the server's date-only convention. */
function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM` for the availability endpoint. */
function toYm(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const DAYS_AHEAD = 45;

/**
 * Vendor booking request — reached from a vendor detail via "Request Booking".
 *
 * The customer picks a service (which sets the amount), an available date, and
 * optional event details, then submits. We avoid a heavyweight calendar widget:
 * the next ~45 days are offered as date chips with booked/blocked days removed,
 * which is faster to tap on a phone and needs no extra dependency. The payload is
 * validated with the shared CreateBookingSchema before it leaves the device, so
 * a bad field is caught here rather than as a 400 from the server.
 */
export default function BookingScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ vendorId: string }>();
  const vendorId = params.vendorId ?? '';

  const vendor = useVendorDetail(vendorId);
  const createBooking = useCreateBooking();

  // A 45-day window starting today can straddle up to THREE calendar months
  // (e.g. late Jan → Feb → early Mar), so fetch this month plus the next two.
  // Fixed count of hook calls — never map a hook over a variable-length array.
  const now = useMemo(() => new Date(), []);
  const thisMonth = toYm(now);
  const nextMonth = toYm(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const monthAfter = toYm(new Date(now.getFullYear(), now.getMonth() + 2, 1));
  const availThis = useVendorAvailability(vendorId, thisMonth);
  const availNext = useVendorAvailability(vendorId, nextMonth);
  const availAfter = useVendorAvailability(vendorId, monthAfter);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ceremonyType, setCeremonyType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const unavailable = useMemo(() => {
    const set = new Set<string>();
    for (const avail of [availThis.data, availNext.data, availAfter.data]) {
      if (!avail) continue;
      for (const d of avail.bookedDates) set.add(d);
      for (const b of avail.blockedDates) set.add(b.date);
    }
    return set;
  }, [availThis.data, availNext.data, availAfter.data]);

  const dateOptions = useMemo(() => {
    const out: string[] = [];
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const ymd = toYmd(d);
      if (!unavailable.has(ymd)) out.push(ymd);
    }
    return out;
  }, [now, unavailable]);

  if (vendor.isLoading) {
    return (
      <Screen>
        <AppHeader title="Request Booking" showBack />
        <Card className="mb-3">
          <Skeleton height={16} width="55%" radius={6} />
          <Skeleton height={12} width="35%" radius={6} className="mt-2" />
        </Card>
        <Card className="mb-3">
          <Skeleton height={16} width="55%" radius={6} />
          <Skeleton height={12} width="35%" radius={6} className="mt-2" />
        </Card>
      </Screen>
    );
  }

  if (vendor.isError || !vendor.data) {
    return (
      <Screen>
        <AppHeader title="Request Booking" showBack />
        <ErrorState error={vendor.error} onRetry={() => void vendor.refetch()} />
      </Screen>
    );
  }

  const services = vendor.data.services ?? [];

  if (services.length === 0) {
    return (
      <Screen>
        <AppHeader title="Request Booking" subtitle={vendor.data.businessName} showBack />
        <EmptyState
          title="No bookable packages"
          message={`${vendor.data.businessName} hasn’t listed any bookable services yet. Save the vendor and check back soon.`}
        />
      </Screen>
    );
  }

  const selectedService =
    services.find((s) => s.id === selectedServiceId) ?? null;

  const handleSubmit = (): void => {
    setFormError(null);

    if (!selectedService) {
      setFormError('Please choose a package.');
      return;
    }
    if (!selectedDate) {
      setFormError('Please choose an event date.');
      return;
    }

    const trimmedGuests = guestCount.trim();
    const guestNum = trimmedGuests ? Number(trimmedGuests) : undefined;
    if (
      guestNum !== undefined &&
      (!Number.isInteger(guestNum) || guestNum <= 0)
    ) {
      setFormError('Guest count must be a whole number greater than zero.');
      return;
    }

    const payload = {
      vendorId,
      serviceId: selectedService.id,
      eventDate: selectedDate,
      totalAmount: selectedService.priceFrom,
      packageName: selectedService.name,
      packagePrice: selectedService.priceFrom,
      ...(ceremonyType.trim() ? { ceremonyType: ceremonyType.trim() } : {}),
      ...(guestNum !== undefined ? { guestCount: guestNum } : {}),
      ...(eventLocation.trim() ? { eventLocation: eventLocation.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    const parsed = CreateBookingSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? 'Please check the form and try again.',
      );
      return;
    }

    createBooking.mutate(parsed.data, {
      onSuccess: () => {
        toast.show({
          message: `Booking request sent to ${vendor.data.businessName}. Track it under My Bookings.`,
          type: 'success',
        });
        router.replace('/(app)/bookings');
      },
      onError: (err) => {
        const { title, message } = describeError(err);
        toast.show({ message: `${title}. ${message}`, type: 'error' });
      },
    });
  };

  return (
    <Screen scroll keyboardAvoiding>
      <AppHeader
        title="Request Booking"
        subtitle={vendor.data.businessName}
        showBack
      />

      {/* ── Package ──────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.duration(300)}>
        <Eyebrow text="Package" className="mb-4" />
        {services.map((service) => {
          const isSelected = service.id === selectedServiceId;
          return (
            <Pressable
              key={service.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedServiceId(service.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`rounded-2xl p-4 mb-3 border ${
                isSelected
                  ? 'bg-gold/10 border-gold'
                  : 'bg-surface border-gold/20'
              }`}
              style={shadowWarm}
            >
              <View className="flex-row items-baseline justify-between">
                <Text className="font-semibold text-ink flex-1 pr-3">
                  {service.name}
                </Text>
                <Text className="text-sm font-semibold text-teal">
                  {formatINR(service.priceFrom)}
                </Text>
              </View>
              <Text className="text-xs text-muted mt-1">per {service.unit}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* ── Date ─────────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(60).duration(300)}>
        <Eyebrow text="Event Date" className="mt-4 mb-2" />
        <Text className="text-xs text-muted text-center mb-3">
          Unavailable dates are hidden. Showing the next {DAYS_AHEAD} days.
        </Text>
        {dateOptions.length === 0 ? (
          <Card className="mb-2">
            <Text className="text-sm text-muted">
              No open dates in the next {DAYS_AHEAD} days. Please contact the vendor.
            </Text>
          </Card>
        ) : (
          <View className="flex-row flex-wrap gap-2 mb-2">
            {dateOptions.map((date) => {
              const isSelected = date === selectedDate;
              return (
                <Pressable
                  key={date}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedDate(date);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`px-3 py-2 rounded-full border ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-gold/40'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-on-primary' : 'text-ink'
                    }`}
                  >
                    {formatDate(date)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* ── Optional details ─────────────────────────────────────────────── */}
      <Animated.View entering={FadeInUp.delay(120).duration(300)}>
        <Eyebrow text="Event Details" className="mt-6 mb-2" />
        <Text className="text-xs text-muted text-center mb-3">
          All fields are optional.
        </Text>

        <Input
          label="Ceremony type"
          placeholder="e.g. Wedding, Sangeet, Reception"
          value={ceremonyType}
          onChangeText={setCeremonyType}
          containerClassName="mb-4"
        />
        <Input
          label="Guest count"
          placeholder="e.g. 250"
          value={guestCount}
          onChangeText={setGuestCount}
          keyboardType="number-pad"
          containerClassName="mb-4"
        />
        <Input
          label="Event location"
          placeholder="City or venue"
          value={eventLocation}
          onChangeText={setEventLocation}
          containerClassName="mb-4"
        />
        <Input
          label="Notes for the vendor"
          placeholder="Anything they should know"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          containerClassName="mb-4"
        />
      </Animated.View>

      {/* ── Summary + submit ─────────────────────────────────────────────── */}
      {selectedService ? (
        <Card elevated className="bg-gold/10 border-gold/40 mb-4 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Estimated total</Text>
            <Text className="font-heading text-xl text-primary">
              {formatINR(selectedService.priceFrom)}
            </Text>
          </View>
          <Text className="text-xs text-muted mt-1">
            Final amount is confirmed by the vendor.
          </Text>
        </Card>
      ) : null}

      {formError ? <ErrorBanner message={formError} className="mb-3" /> : null}

      <View className="mb-8">
        <Button
          title="Send booking request"
          variant="primary"
          loading={createBooking.isPending}
          disabled={!selectedService || !selectedDate}
          onPress={handleSubmit}
        />
      </View>
    </Screen>
  );
}
