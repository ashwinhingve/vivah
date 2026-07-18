/**
 * Client-side currency formatting for Smart Shaadi web.
 *
 * Mirrors `apps/api/src/lib/currency.ts` but adapted for browser environment.
 * Converts the wire shape `{ paise: string, currency: string }` to locale-aware
 * formatted strings.
 *
 * ## Separation from API
 * `apps/web` and `apps/api` are separate packages and cannot import directly
 * from each other. This file duplicates logic to ensure consistency while
 * respecting package boundaries.
 *
 * If you modify the API version, update this file identically (except for
 * async operations, which the browser can't handle the same way).
 *
 * ## Display-only, no FX
 * Like the API version, these functions render `displayCurrency` as a
 * presentation choice only. No conversion math; no rate tables.
 */

import type { SupportedCurrency } from '@smartshaadi/types';

/**
 * Wire representation of money from the API.
 * `paise` is always a string (JSON.stringify can't handle bigint).
 */
export interface WireMoney {
  paise: string;
  currency: string;
}

/**
 * Locale mapping for each currency (mirrored from API).
 */
const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  INR: 'en-IN', // Lakh/crore grouping
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  AED: 'ar-AE',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
};

/**
 * Get the minor-unit exponent for a currency (mirrored from API).
 *
 * All 8 Smart Shaadi currencies use 2 decimal places.
 * Hardcoded for simplicity and to make the assumption explicit.
 */
function getMinorUnitExponent(currency: SupportedCurrency): number {
  const exponentMap: Record<SupportedCurrency, number> = {
    INR: 2,
    USD: 2,
    GBP: 2,
    EUR: 2,
    AED: 2,
    CAD: 2,
    AUD: 2,
    SGD: 2,
  };
  const exponent = exponentMap[currency];
  if (exponent === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return exponent;
}

/**
 * Parse a paise value (string) into a BigInt safely.
 * Throws if the value is not a valid integer.
 */
function parsePaise(paise: string): bigint {
  if (typeof paise !== 'string' || paise === '') {
    throw new Error(
      `Invalid paise value: "${paise}" is not a valid integer string.`,
    );
  }
  try {
    return BigInt(paise);
  } catch (e) {
    throw new Error(
      `Invalid paise value: "${paise}" is not a valid integer. Error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Split a paise amount (bigint) into integer and fractional parts.
 * Returns [major, minor] where major carries the sign and minor is >= 0.
 */
function splitPaise(paise: bigint, exponent: number): [major: bigint, minor: bigint] {
  const divisor = BigInt(10 ** exponent);

  // Use absolute value for the split, so minor is always >= 0
  const absPaise = paise < 0n ? -paise : paise;
  const major = paise < 0n ? -(absPaise / divisor) : absPaise / divisor;
  const minor = absPaise % divisor;

  return [major, minor];
}

/**
 * Format a money amount from the wire shape `{ paise: string, currency: string }`
 * as a locale-aware currency string.
 *
 * @param wire Wire money object with paise (decimal string) and currency code.
 * @param opts Optional formatting options.
 * @param opts.ascii If true, use ASCII symbols (Rs. not ₹) for PDF-safe rendering.
 * @returns A locale-formatted string like "₹12,34,567.89".
 *
 * @throws Error if paise is invalid or currency is unsupported.
 *
 * ## Examples
 * ```
 * formatWireMoney({ paise: '123456789', currency: 'INR' })
 * // => "₹12,34,567.89"
 *
 * formatWireMoney({ paise: '123456789', currency: 'INR' }, { ascii: true })
 * // => "Rs. 12,34,567.89"
 *
 * formatWireMoney({ paise: '1234', currency: 'USD' })
 * // => "$12.34"
 * ```
 */
export function formatWireMoney(
  wire: WireMoney,
  opts?: { ascii?: boolean },
): string {
  const currency = wire.currency as SupportedCurrency;
  const paiseBI = parsePaise(wire.paise);
  const exponent = getMinorUnitExponent(currency); // Throws if unsupported
  const [major, minor] = splitPaise(paiseBI, exponent);

  const locale = CURRENCY_LOCALE_MAP[currency];
  if (!locale) {
    throw new Error(`Currency ${currency} not mapped to locale`);
  }

  // Determine sign from original paise value (carries the full sign)
  const isNegative = paiseBI < 0n;
  const majorAsNumber = Number(major);
  const absMajor = Math.abs(majorAsNumber);

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Format major part (always use absolute value for Intl)
  const formattedAbsolute = formatter.format(absMajor);

  // Determine decimal separator by formatting a test value
  const testFormat = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(1.5);
  const actualDecimalSep = testFormat.includes(',') ? ',' : '.';

  // Append fractional part, then add sign if needed
  const minorStr = String(minor).padStart(exponent, '0');
  let formatted = formattedAbsolute + actualDecimalSep + minorStr;

  if (isNegative) {
    formatted = `-${formatted}`;
  }

  if (opts?.ascii) {
    formatted = formatted.replace('₹', 'Rs.');
    formatted = formatted.replace('$', 'US$');
    formatted = formatted.replace('€', 'EUR');
    formatted = formatted.replace('£', 'GBP');
    formatted = formatted.replace('د.إ', 'AED');
  }

  return formatted;
}

/**
 * Format a money amount from the wire shape, using ASCII symbols.
 *
 * Convenience wrapper for `formatWireMoney(wire, { ascii: true })`.
 *
 * @param wire Wire money object.
 * @returns ASCII-safe currency string (e.g., "Rs. 12,34,567.89" not "₹12,34,567.89").
 *
 * @see formatWireMoney for full documentation.
 */
export function formatWireMoneyAscii(wire: WireMoney): string {
  return formatWireMoney(wire, { ascii: true });
}

/**
 * Overload: format with raw paise + currency (string variant of API function).
 * Useful in contexts where you've already parsed the wire shape.
 *
 * @param paise The amount in minor units (as a string from wire).
 * @param currency The ISO 4217 currency code.
 * @param opts Optional formatting options.
 * @returns A locale-formatted string.
 *
 * ## Note
 * This is a convenience overload. If you have a WireMoney object, prefer
 * `formatWireMoney()` for clarity.
 */
export function formatMoney(
  paise: string,
  currency: string,
  opts?: { ascii?: boolean },
): string {
  return formatWireMoney({ paise, currency }, opts);
}
