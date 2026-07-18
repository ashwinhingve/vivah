/**
 * Multi-City Vendor Network (Unit 6.5, Sprint J) — shared contracts.
 *
 * City lifecycle: PLANNED → EXPANSION → ACTIVE. The registry normalizes the
 * free-text vendors.city; density/ops dashboards join vendors.city_id, while
 * public filters and SEO keep reading the free-text column unchanged.
 */

export type CityStatus = 'ACTIVE' | 'EXPANSION' | 'PLANNED';
export const CITY_STATUSES: readonly CityStatus[] = ['ACTIVE', 'EXPANSION', 'PLANNED'];

export interface City {
  id: string;
  name: string;
  slug: string;
  state: string;
  status: CityStatus;
  targetVendorsPerCategory: number;
  latitude: string | null;   // decimal serialized as string (Drizzle convention)
  longitude: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CityCategoryDensity {
  category: string;
  approved: number;
  total: number;
  target: number;
  /** max(0, target - approved) — vendors still needed in this category. */
  gap: number;
}

export interface CityDensityReport {
  city: City;
  totalVendorsApproved: number;
  totalVendorsAll: number;
  categories: CityCategoryDensity[];
  /** Categories at/above target ÷ categories evaluated, as 0..100. */
  coveragePct: number;
  bookingsLast90d: number;
  /** Captured payments (rupees, string decimal) for this city's vendors, last 90d. */
  revenueLast90d: string;
}

export interface CityNetworkOverview {
  cities: Array<{
    city: City;
    vendorsApproved: number;
    coveragePct: number;
    gapCount: number;
    bookingsLast90d: number;
  }>;
  /** Vendors whose free-text city matched no registry row (city_id IS NULL). */
  unmappedVendorCount: number;
  unmappedCityNames: string[];
}
