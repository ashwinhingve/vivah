import type {
  VendorCategory,
  VendorProfile,
  VendorReview,
} from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

/**
 * Sort orders accepted by `GET /vendors`. Mirrors VENDOR_SORTS in
 * `@smartshaadi/schemas` (vendor.ts) — the server rejects anything else with a
 * 400, so keeping this union narrow turns a runtime rejection into a compile
 * error at the call site.
 */
export type VendorSort = 'rating' | 'price_low' | 'price_high' | 'popular' | 'recent';

export interface VendorListParams {
  category?: VendorCategory;
  city?: string;
  state?: string;
  /** Free-text search over business name, tagline, description and city. */
  q?: string;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  sort?: VendorSort;
  page?: number;
  /** Server caps this at 48. */
  limit?: number;
}

/**
 * `GET /vendors` returns the page inside `data`, not in the envelope's `meta` —
 * unlike the match feed. Shape taken from `listVendors` in
 * apps/api/src/vendors/service.ts.
 */
export interface VendorListPage {
  vendors: VendorProfile[];
  meta: { page: number; total: number; limit: number };
}

/**
 * `GET /vendors/:id/availability?month=YYYY-MM`. Drives the booking calendar:
 * `bookedDates` are days already taken by confirmed bookings, `blockedDates` are
 * days the vendor marked unavailable (with an optional reason). Both are the
 * dates the picker must disable for the requested month.
 */
export interface VendorAvailability {
  bookedDates: string[];
  blockedDates: { date: string; reason: string | null }[];
}

/**
 * Vendor discovery surface.
 *
 * Read-only plus favourites, enquiries and availability. Booking itself lives in
 * `BookingEndpoints` (bookings.ts); this group stops at telling the booking
 * screen which dates are free.
 *
 * Paths verified against apps/api/src/vendors/router.ts, mounted at
 * '/api/v1/vendors' in apps/api/src/index.ts.
 */
export class VendorEndpoints {
  constructor(private readonly client: ApiClient) {}

  /**
   * Public listing — approved, active vendors only (the server filters on
   * status='APPROVED'). Works signed-out; when a session IS present the server
   * populates `isFavorite` on each row, which is why the screen must not cache
   * this across sign-in.
   */
  list(params: VendorListParams = {}): Promise<VendorListPage> {
    return this.client.get<VendorListPage>('/api/v1/vendors', {
      query: {
        category: params.category,
        city: params.city,
        state: params.state,
        q: params.q,
        priceMin: params.priceMin,
        priceMax: params.priceMax,
        minRating: params.minRating,
        verifiedOnly: params.verifiedOnly,
        sort: params.sort,
        page: params.page,
        limit: params.limit,
      },
    });
  }

  get(vendorId: string): Promise<VendorProfile> {
    return this.client.get<VendorProfile>(`/api/v1/vendors/${vendorId}`);
  }

  getReviews(vendorId: string): Promise<{ reviews: VendorReview[] }> {
    return this.client.get<{ reviews: VendorReview[] }>(
      `/api/v1/vendors/${vendorId}/reviews`,
    );
  }

  /** Toggles — the server flips the current state and returns the new one. */
  toggleFavorite(vendorId: string): Promise<{ favorited: boolean }> {
    return this.client.post<{ favorited: boolean }>(
      `/api/v1/vendors/${vendorId}/favorite`,
    );
  }

  getFavorites(): Promise<{ vendors: VendorProfile[] }> {
    return this.client.get<{ vendors: VendorProfile[] }>(
      '/api/v1/vendors/favorites',
    );
  }

  sendInquiry(
    vendorId: string,
    input: { message: string; eventDate?: string; phone?: string },
  ): Promise<{ id: string }> {
    return this.client.post<{ id: string }>(
      `/api/v1/vendors/${vendorId}/inquiries`,
      input,
    );
  }

  /** Enquiries the signed-in user has sent (not the ones a vendor received). */
  getMyInquiries(): Promise<{ inquiries: unknown[] }> {
    return this.client.get<{ inquiries: unknown[] }>(
      '/api/v1/vendors/inquiries/mine',
    );
  }

  /**
   * Booked + blocked dates for one month (`YYYY-MM`). Public — the booking
   * screen needs it before the user is committed to anything.
   */
  getAvailability(vendorId: string, month: string): Promise<VendorAvailability> {
    return this.client.get<VendorAvailability>(
      `/api/v1/vendors/${vendorId}/availability`,
      { query: { month } },
    );
  }
}
