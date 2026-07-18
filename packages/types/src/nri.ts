/**
 * Smart Shaadi — NRI / international matching contracts
 * packages/types/src/nri.ts
 *
 * Phase 7 Sprint G (Unit 7.2). Frozen in Phase 0 so all four parallel tracks
 * build against one shape:
 *   Track A — matchmaking (cross-border hard-filter bypass)
 *   Track B — timezone-aware scheduling
 *   Track C — multi-currency display
 *   Track D — NRI discovery UX
 *
 * Mirrors the `profiles` columns added in migration 0034.
 */

/** Mirrors the `residency_status` pg enum (packages/db/schema/index.ts). */
export type ResidencyStatus =
  | 'CITIZEN'
  | 'PERM_RESIDENT'
  | 'WORK_VISA'
  | 'STUDENT_VISA'
  | 'DEPENDENT_VISA'
  | 'OTHER';

export const RESIDENCY_STATUSES: readonly ResidencyStatus[] = [
  'CITIZEN', 'PERM_RESIDENT', 'WORK_VISA', 'STUDENT_VISA', 'DEPENDENT_VISA', 'OTHER',
] as const;

/** Human labels for UI. Kept here so API and web never drift apart. */
export const RESIDENCY_STATUS_LABELS: Record<ResidencyStatus, string> = {
  CITIZEN:        'Citizen',
  PERM_RESIDENT:  'Permanent Resident',
  WORK_VISA:      'Work Visa',
  STUDENT_VISA:   'Student Visa',
  DEPENDENT_VISA: 'Dependent Visa',
  OTHER:          'Other',
};

/** Mirrors the `money_currency` pg enum (packages/db/schema/sharedEnums.ts). */
export type SupportedCurrency =
  | 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'CAD' | 'AUD' | 'SGD';

export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD',
] as const;

/**
 * The NRI fields stored in Postgres on `profiles` — the queryable ones the
 * matchmaking hard-filter and the search facets read on every feed build.
 */
export interface NriProfileFields {
  /** ISO 3166-1 alpha-2. Defaults to 'IN'; never null in the DB. */
  countryOfResidence: string;
  /** ISO 3166-1 alpha-2. May differ from residence. Null = unstated. */
  citizenship: string | null;
  residencyStatus: ResidencyStatus | null;
  willingToRelocate: boolean;
  /**
   * Bilateral opt-in. BOTH sides must be true before the distance hard-filter
   * is bypassed for a cross-border pair. Opting in never widens a domestic feed.
   */
  openToNriMatching: boolean;
  /** IANA zone, e.g. 'America/Toronto'. Null → inferred from countryOfResidence. */
  ianaTimezone: string | null;
  /** Presentation only — selects how money renders. Never converts value. */
  displayCurrency: SupportedCurrency;
}

/**
 * Descriptive detail that lives in Mongo `ProfileContent.nri` — never queried by
 * the filter chain. Deliberately holds NO visa numbers or documents: this is a
 * matching signal, not a KYC record (CLAUDE.md — store verification status only).
 */
export interface NriSection {
  /** Free text, e.g. "H-1B, renewal filed". Never a document or number. */
  visaDetails?: string;
  /** e.g. "Open to moving to India within 2 years". */
  relocationTimeline?: string;
  yearsAbroad?: number;
}

/** Partial update payload for the Postgres-side NRI fields. */
export type NriProfileUpdate = Partial<NriProfileFields> & { nri?: NriSection };

/** Facets for the NRI discovery surfaces (Track D → Track A filter contract). */
export interface NriSearchFilters {
  /** Only surface profiles that have opted into cross-border matching. */
  nriOnly?: boolean;
  /** ISO alpha-2 codes to narrow to. Empty/absent = any country. */
  countries?: string[];
  residencyStatuses?: ResidencyStatus[];
  willingToRelocate?: boolean;
}
