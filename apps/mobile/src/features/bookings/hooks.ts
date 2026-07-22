import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  BookingListParams,
  CreateBookingInput,
} from '@smartshaadi/api-client';
import { api } from '../../lib/api';

/**
 * Vendor bookings — the customer side of the workflow.
 *
 * Create a booking request, list your bookings, and cancel one. Confirm/complete
 * are the vendor's actions and live on the web console, so they are not here.
 */

/** The signed-in user's bookings (as the customer). */
export function useMyBookings(params: BookingListParams = {}) {
  return useQuery({
    queryKey: ['bookings', 'mine', params],
    queryFn: () => api.bookings.list({ role: 'customer', ...params }),
  });
}

/**
 * Create a booking. Invalidates the list and the vendor's availability — the
 * new booking is a pending hold the calendar should reflect on next open.
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.bookings.create(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({
        queryKey: ['vendors', 'availability', variables.vendorId],
      });
    },
  });
}

/** Cancel a booking, with an optional reason. */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { bookingId: string; reason?: string }) =>
      api.bookings.cancel(input.bookingId, input.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
