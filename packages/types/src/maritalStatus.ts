/**
 * Smart Shaadi — Marital Status types
 *
 * Mirrors the `marital_status` pgEnum from packages/db/schema/index.ts.
 * Use these constants everywhere to avoid string-literal drift.
 */

export const MARITAL_STATUS = {
  NEVER_MARRIED: 'NEVER_MARRIED',
  DIVORCED:      'DIVORCED',
  WIDOWED:       'WIDOWED',
  SEPARATED:     'SEPARATED',
} as const;

export type MaritalStatus = (typeof MARITAL_STATUS)[keyof typeof MARITAL_STATUS];

/**
 * Statuses that trigger the divorcee/widow support onboarding journey.
 * SEPARATED is excluded — they are not yet formally divorced, so the
 * confidence-rebuilding journey is not surfaced until the status is DIVORCED.
 */
export const DIVORCEE_WIDOW_STATUSES: ReadonlyArray<MaritalStatus> = [
  MARITAL_STATUS.DIVORCED,
  MARITAL_STATUS.WIDOWED,
] as const;

/**
 * Returns true when the marital status should trigger the dedicated
 * divorcee/widow onboarding journey.
 */
export function isDivorceeOrWidow(status: MaritalStatus | string | undefined | null): boolean {
  if (!status) return false;
  return (DIVORCEE_WIDOW_STATUSES as ReadonlyArray<string>).includes(status);
}
