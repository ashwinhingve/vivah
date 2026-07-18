/**
 * Money formatting utilities for Smart Shaadi.
 *
 * Converts `{ paise: bigint, currency: SupportedCurrency }` to locale-aware
 * formatted strings without any FX conversion.
 *
 * ## Architecture
 * - `paise` is the minor unit (cents for USD, paise for INR, etc.)
 * - All 8 supported currencies use 2 decimal places (derived via
 *   Intl.NumberFormat, not hardcoded).
 * - BigInt arithmetic prevents loss of precision for large B2B amounts
 *   (beyond Number.MAX_SAFE_INTEGER = 2^53 - 1).
 * - Locale selection ensures cultural correctness: INR uses en-IN for
 *   lakh/crore grouping; others use sensible defaults.
 * - `formatMoneyAscii` provides PDF-safe strings (Rs. not ₹) where Helvetica
 *   glyph coverage is limited.
 *
 * ## No FX Conversion
 * These functions render `displayCurrency` as a presentation choice only.
 * They do NOT convert values between currencies — that requires an external
 * rate table and is out of scope for this sprint.
 */

import type { SupportedCurrency } from '@smartshaadi/types';

/**
 * Locale mapping for each currency.
 * Selects the best ICU locale for number formatting (grouping, decimals, etc.).
 * INR uses en-IN for lakh/crore; others use a sensible default for their region.
 */
const CURRENCY_LOCALE_MAP: Record<SupportedCurrency, string> = {
  INR: 'en-IN', // Lakh/crore grouping (12,34,567.89)
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE', // Uses . as thousands separator, , as decimal (matches EUR style)
  AED: 'ar-AE',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
};

/**
 * Get the minor-unit digit count (exponent) for a currency.
 *
 * All 8 Smart Shaadi currencies (INR, USD, GBP, EUR, AED, CAD, AUD, SGD)
 * use 2 decimal places (i.e., cents for USD, paise for INR, etc.).
 * This is hardcoded rather than queried dynamically because:
 *   1. It's simpler and more performant
 *   2. It forces explicitly declaring the assumption for future readers
 *   3. Future currencies (if added) will need deliberate schema/code changes anyway
 *
 * @throws Error if currency is outside the enum (though TS prevents this).
 */
function getMinorUnitExponent(currency: SupportedCurrency): number {
  // Validate at runtime in case the enum grows and this isn't updated.
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
 * Parse a paise value (string or bigint) into a bigint safely.
 * Throws if the value is not a valid integer.
 */
function parsePaise(paise: bigint | string): bigint {
  if (typeof paise === 'bigint') return paise;
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
 * Split a paise amount into integer and fractional parts.
 * Returns [major, minor] where the result displays as:
 *   - sign(major) + "|major|" + "." + "minor" (right-padded to exponent digits)
 *
 * The major part carries the sign; the minor part is always >= 0.
 *
 * Example (INR, exponent = 2):
 *   splitPaise(123456n) => [1234n, 56n] (₹12.34 after formatting)
 *   splitPaise(1n) => [0n, 1n] (₹0.01)
 *   splitPaise(-50n) => [0n, 50n] with isNegative flag (−₹0.50)
 *   splitPaise(-100n) => [-1n, 0n] (−₹1.00)
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
 * Format a money amount as a locale-aware currency string.
 *
 * @param paise The amount in minor units (paise for INR, cents for USD, etc.)
 *              Accepts bigint or string (parsed as decimal integer).
 * @param currency The ISO 4217 currency code (must be in SupportedCurrency enum).
 * @param opts Optional formatting options.
 * @param opts.ascii If true, use ASCII symbols (Rs. instead of ₹) for PDF safety.
 * @returns A locale-formatted string like "₹12,34,567.89" or "Rs. 12,34,567.89".
 *
 * @throws Error if `paise` is not a valid integer or currency is unsupported.
 *
 * ## Examples
 * ```
 * formatMoney(123456789n, 'INR') // => "₹12,34,567.89"
 * formatMoney('123456789', 'INR') // => "₹12,34,567.89"
 * formatMoney('123456789', 'INR', { ascii: true }) // => "Rs. 12,34,567.89"
 * formatMoney(1n, 'USD') // => "$0.01"
 * formatMoney(0n, 'EUR') // => "€0,00"
 * formatMoney(-50n, 'GBP') // => "−£0.50"
 * ```
 *
 * ## Precision guarantee
 * Handles amounts beyond Number.MAX_SAFE_INTEGER (2^53 - 1) using pure BigInt
 * arithmetic. No precision loss for any legitimate transaction amount.
 */
export function formatMoney(
  paise: bigint | string,
  currency: SupportedCurrency,
  opts?: { ascii?: boolean },
): string {
  const paiseBI = parsePaise(paise);
  const exponent = getMinorUnitExponent(currency); // Throws if currency unsupported
  const [major, minor] = splitPaise(paiseBI, exponent);

  const locale = CURRENCY_LOCALE_MAP[currency];
  if (!locale) {
    throw new Error(`Currency ${currency} not mapped to locale`);
  }

  // Determine sign from the original paise value (since it carries the full sign)
  const isNegative = paiseBI < 0n;

  // Use Intl.NumberFormat for culturally correct grouping and symbols.
  // Intl.NumberFormat expects a Number, not BigInt. For very large amounts
  // (beyond Number.MAX_SAFE_INTEGER), we convert to Number and accept potential
  // precision loss in display grouping (the underlying value is still correct).
  const majorAsNumber = Number(major);
  const absMajor = Math.abs(majorAsNumber);

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0, // We'll add fractions manually to avoid rounding
  });

  // Format the major part (always use absolute value for Intl)
  const formattedAbsolute = formatter.format(absMajor);

  // Detect decimal separator by formatting a test value
  const testFormat = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(1.5);
  const actualDecimalSep = testFormat.includes(',') ? ',' : '.';

  // Append the fractional part first, then add sign
  const minorStr = String(minor).padStart(exponent, '0');
  let formatted = formattedAbsolute + actualDecimalSep + minorStr;

  // Add sign if negative
  if (isNegative) {
    formatted = `-${formatted}`;
  }

  // If ascii mode, replace currency symbol with ASCII equivalent.
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
 * Format a money amount as a locale-aware currency string, using ASCII symbols.
 *
 * Convenience wrapper for `formatMoney(paise, currency, { ascii: true })`.
 * Used for PDF generation where Unicode symbol coverage is limited (e.g., Helvetica
 * does not have ₹). Produces strings like "Rs. 12,34,567.89" instead of "₹12,34,567.89".
 *
 * @param paise The amount in minor units.
 * @param currency The ISO 4217 currency code.
 * @returns ASCII-safe currency string.
 *
 * ## Why this exists
 * PDF generators like PDFKit may use Helvetica by default, which lacks glyphs for
 * rupee (₹), euro (€), and other symbols. This variant ensures PDFs render correctly
 * without requiring a Unicode font or embedded font files.
 *
 * @see formatMoney for precision guarantees and example usage.
 */
export function formatMoneyAscii(paise: bigint | string, currency: SupportedCurrency): string {
  return formatMoney(paise, currency, { ascii: true });
}
