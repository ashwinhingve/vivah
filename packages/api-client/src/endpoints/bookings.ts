import type { BookingSummary } from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

/**
 * Body for `POST /bookings`. Mirrors `CreateBookingSchema` in
 * `@smartshaadi/schemas` (vendor.ts) — the server is the validating authority, so
 * this stays a plain shape rather than pulling schemas in as a dependency. The
 * caller (mobile) validates with the Zod schema before handing the object here.
 * `eventDate` is `YYYY-MM-DD`; amounts are rupees, not paise (the bookings table
 * stores rupees, unlike subscription plans).
 */
export interface CreateBookingInput {
  vendorId: string;
  serviceId?: string;
  eventDate: string;
  ceremonyType?: string;
  notes?: string;
  totalAmount: number;
  packageName?: string;
  packagePrice?: number;
  guestCount?: number;
  eventLocation?: string;
  addons?: {
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string | null;
  }[];
}

export type BookingRole = 'customer' | 'vendor';

/** Matches the server's `BookingListQuery` enum (bookings/router.ts). */
export type BookingStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type BookingTimeline = 'all' | 'upcoming' | 'past';

export interface BookingListParams {
  /** Default 'customer' server-side — the bookings the signed-in user made. */
  role?: BookingRole;
  status?: BookingStatusFilter;
  timeline?: BookingTimeline;
  page?: number;
  /** Server caps this at 50. */
  limit?: number;
}

export interface BookingListPage {
  bookings: BookingSummary[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Vendor booking surface.
 *
 * Create + read + cancel from the customer side, which is all mobile needs:
 * confirm/complete/reschedule are the vendor's side of the workflow and stay on
 * the web vendor console. Paths verified against apps/api/src/bookings/router.ts,
 * mounted at '/api/v1/bookings' in apps/api/src/index.ts.
 */
export class BookingEndpoints {
  constructor(private readonly client: ApiClient) {}

  /** Create a booking request. Server returns it in PENDING. */
  create(input: CreateBookingInput): Promise<{ booking: BookingSummary }> {
    return this.client.post<{ booking: BookingSummary }>(
      '/api/v1/bookings',
      input,
    );
  }

  /** The signed-in user's bookings, newest event first. */
  list(params: BookingListParams = {}): Promise<BookingListPage> {
    return this.client.get<BookingListPage>('/api/v1/bookings', {
      query: {
        role: params.role,
        status: params.status,
        timeline: params.timeline,
        page: params.page,
        limit: params.limit,
      },
    });
  }

  get(bookingId: string): Promise<{ booking: BookingSummary }> {
    return this.client.get<{ booking: BookingSummary }>(
      `/api/v1/bookings/${bookingId}`,
    );
  }

  /** Cancel a booking. Carries an optional reason, so it is a PUT with a body. */
  cancel(
    bookingId: string,
    reason?: string,
  ): Promise<{ booking: BookingSummary }> {
    return this.client.put<{ booking: BookingSummary }>(
      `/api/v1/bookings/${bookingId}/cancel`,
      reason === undefined ? {} : { reason },
    );
  }
}
