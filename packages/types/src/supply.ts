/**
 * Smart Shaadi — Premium package supply + post-marriage service contracts
 * packages/types/src/supply.ts
 *
 * Phase 8, Units 8.1 (supply half) and 8.2. Mirrors the tables added in
 * migration 0037.
 *
 * This is the file `destination.ts` said would not exist: "There is deliberately
 * no package, price or venue-supply shape in this file: destination supply is
 * Tier 3, blocked on venue/vendor partnerships." That posture changed — the
 * supply half is now built and seeded with fictional placeholder inventory. The
 * partnership blocker governs whether inventory is REAL, not whether it exists.
 *
 * MONEY: every amount here is a decimal string in RUPEES (e.g. '450000.00'),
 * matching `vendors.priceMin` and `bookings.packagePrice`. NOT bigint paise —
 * see the Money note in packages/db/schema/phase8.ts. Amounts are strings rather
 * than numbers because pg `numeric` exceeds float64's exact range and the API
 * serialises it verbatim; parse at the render boundary, never in transit.
 *
 * Dates are `YYYY-MM-DD` strings, matching how pg `date` columns serialise
 * elsewhere in this codebase.
 */

// ── 8.1 Premium packages ─────────────────────────────────────────────────────

export const PREMIUM_PACKAGE_TIERS = ['ESSENTIAL', 'SIGNATURE', 'LUXE'] as const;
export type PremiumPackageTier = (typeof PREMIUM_PACKAGE_TIERS)[number];

export const PACKAGE_INCLUSION_KINDS = ['INCLUSION', 'EXCLUSION'] as const;
export type PackageInclusionKind = (typeof PACKAGE_INCLUSION_KINDS)[number];

/** One line of a package's "what you get / what you don't" list. */
export interface PackageInclusion {
  id:        string;
  packageId: string;
  kind:      PackageInclusionKind;
  label:     string;
  sortOrder: number;
}

/**
 * A blocked WINDOW, not a blocked day. A venue closes for a monsoon season, and
 * ninety rows would be a worse answer to the same question.
 */
export interface PackageAvailabilityBlock {
  id:          string;
  packageId:   string;
  blockedFrom: string;
  blockedTo:   string;
  reason:      string | null;
}

/** Mirrors a `premium_packages` row. */
export interface PremiumPackage {
  id:       string;
  vendorId: string;
  /** Public identifier — the detail route is /packages/[slug]. Unique. */
  slug:  string;
  title: string;
  tier:  PremiumPackageTier;
  /**
   * The PACKAGE's city, denormalised from the vendor: one vendor may sell in
   * several cities and browse filters on this, not on the vendor's own city.
   */
  destinationCity: string;
  /**
   * Canonical link into the admin-managed `cities` registry (migration 0039).
   * Null when the operator has not registered that destination yet — the free
   * text above still renders, so an unregistered city never blocks a listing.
   */
  cityId:      string | null;
  countryCode: string;
  /** Decimal string in rupees. */
  priceFrom: string;
  currency:  string;
  guestCapacityMin: number;
  guestCapacityMax: number;
  durationNights:   number;
  summary:      string | null;
  description:  string | null;
  heroImageUrl: string | null;
  /**
   * Seeded fictional inventory rather than a real onboarded partner.
   *
   * INTERNAL PROVENANCE ONLY. It must not hide the row, change its ranking, or
   * alter how it renders. It gates exactly one thing, in the service layer: a
   * placeholder cannot be booked or paid for, because no fictional venue can
   * deliver a wedding. Enquiries stay fully open so the lead is captured.
   */
  isPlaceholder: boolean;
  isActive:      boolean;
  sortOrder:     number;
  createdAt:     string;
  updatedAt:     string;
}

/** A package plus the vendor fields the card and detail views render. */
export interface PremiumPackageWithVendor extends PremiumPackage {
  vendorName:     string;
  vendorCity:     string;
  vendorVerified: boolean;
  vendorRating:   string | null;
}

/** The full detail payload: package, vendor, both inclusion lists, blocks. */
export interface PremiumPackageDetail extends PremiumPackageWithVendor {
  inclusions:   PackageInclusion[];
  exclusions:   PackageInclusion[];
  availability: PackageAvailabilityBlock[];
}

/** One page of browse results. `total` is the unpaginated count. */
export interface PremiumPackageListResult {
  packages: PremiumPackageWithVendor[];
  total:    number;
  page:     number;
  limit:    number;
}

/**
 * One city offered as a browse filter chip.
 *
 * `id` is null for a destination not yet in the admin `cities` registry — the
 * chip still works (it filters on the free-text name), it simply is not backed
 * by a registry row an operator can rename or reorder.
 */
export interface PremiumPackageCityFacet {
  id:    string | null;
  name:  string;
  state: string | null;
  /** Live count, so the UI can show "Udaipur (6)" and never offer an empty chip. */
  packageCount: number;
}

/**
 * Distinct filter values for the browse chips, computed from live rows so the
 * UI never offers a city or tier that would return nothing.
 */
export interface PremiumPackageFacets {
  cities: PremiumPackageCityFacet[];
  tiers:  PremiumPackageTier[];
}

// ── 8.2 Post-marriage services ───────────────────────────────────────────────

export const SERVICE_PRICE_UNITS = [
  'FIXED',
  'PER_HOUR',
  'PER_MONTH',
  'PER_PERSON',
  'QUOTE',
] as const;
export type ServicePriceUnit = (typeof SERVICE_PRICE_UNITS)[number];

export const SERVICE_ENQUIRY_STATUSES = ['OPEN', 'CONTACTED', 'CLOSED'] as const;
export type ServiceEnquiryStatus = (typeof SERVICE_ENQUIRY_STATUSES)[number];

/**
 * An editorial category, stored as a row rather than an enum so admin can add
 * one without a migration.
 */
export interface PostMarriageCategory {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  /** lucide-react icon name, resolved client-side. */
  icon:      string | null;
  sortOrder: number;
  isActive:  boolean;
}

/** A category plus how much live supply sits under it. */
export interface PostMarriageCategoryWithCount extends PostMarriageCategory {
  serviceCount: number;
}

/** Mirrors a `service_partners` row. */
export interface ServicePartner {
  id:         string;
  categoryId: string;
  name:       string;
  slug:       string;
  /** Nullable — legal assistance and gifting registries are delivered remotely. */
  city:        string | null;
  /** Canonical link into the admin-managed `cities` registry (migration 0039). */
  cityId:      string | null;
  state:       string | null;
  countryCode: string;
  description:  string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl:   string | null;
  logoUrl:      string | null;
  rating:       string;
  /** See PremiumPackage.isPlaceholder — same contract. */
  isPlaceholder: boolean;
  isActive:      boolean;
  createdAt:     string;
  updatedAt:     string;
}

/** Mirrors a `post_marriage_services` row. */
export interface PostMarriageService {
  id:          string;
  partnerId:   string;
  categoryId:  string;
  title:       string;
  slug:        string;
  description: string | null;
  /** Decimal strings in rupees. `priceTo` is null for QUOTE or fixed pricing. */
  priceFrom: string | null;
  priceTo:   string | null;
  priceUnit: ServicePriceUnit;
  currency:  string;
  isPlaceholder: boolean;
  isActive:      boolean;
  sortOrder:     number;
  createdAt:     string;
  updatedAt:     string;
}

/** A service joined to the partner and category the views render. */
export interface PostMarriageServiceWithPartner extends PostMarriageService {
  partnerName:   string;
  partnerSlug:   string;
  partnerCity:   string | null;
  partnerRating: string;
  partnerLogoUrl: string | null;
  categoryName:  string;
  categorySlug:  string;
}

/** The detail payload: service, its partner, and the partner's other services. */
export interface PostMarriageServiceDetail extends PostMarriageServiceWithPartner {
  partner:            ServicePartner;
  relatedServices:    PostMarriageService[];
}

export interface PostMarriageServiceListResult {
  services: PostMarriageServiceWithPartner[];
  total:    number;
  page:     number;
  limit:    number;
}

/** Mirrors a `service_enquiries` row. */
export interface ServiceEnquiry {
  id:         string;
  serviceId:  string;
  partnerId:  string;
  customerId: string;
  message:          string;
  preferredContact: string | null;
  city:             string | null;
  status:       ServiceEnquiryStatus;
  partnerReply: string | null;
  repliedAt:    string | null;
  createdAt:    string;
  updatedAt:    string;
  /** Joined for the "my enquiries" and admin triage views. */
  serviceTitle?: string;
  partnerName?:  string;
  customerName?: string;
}
