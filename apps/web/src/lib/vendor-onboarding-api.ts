/**
 * Vendor onboarding wizard — server-side fetch helpers.
 *
 * Thin fetchAuth wrappers, mirroring lib/wedding-api.ts's read-side split.
 * Mutations go through Server Actions (mutateApi in wedding-api.ts), not here.
 */
import { fetchAuth } from './server-fetch';
import type {
  VendorProfile,
  VendorPortfolioDoc,
  VendorBlockedDate,
} from '@smartshaadi/types';
import type { EventTypeValue } from '@smartshaadi/schemas';

export const fetchMyVendor = () => fetchAuth<VendorProfile>('/api/v1/vendors/me');

export const fetchVendorStatus = () =>
  fetchAuth<{
    status: 'DRAFT' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
    rejectionCategory: string | null;
  }>('/api/v1/vendors/me/status');

export const fetchVendorPortfolio = (vendorId: string) =>
  fetchAuth<{ portfolio: VendorPortfolioDoc | null }>(`/api/v1/vendors/${vendorId}/portfolio`);

export const fetchVendorEventTypes = (vendorId: string) =>
  fetchAuth<{ eventTypes: EventTypeValue[] }>(`/api/v1/vendors/${vendorId}/event-types`);

export const fetchVendorBlockedDates = () =>
  fetchAuth<{ dates: VendorBlockedDate[] }>('/api/v1/vendors/blocked-dates');
