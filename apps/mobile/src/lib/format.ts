/**
 * Money and number formatting, mirroring apps/web/src/lib/format.ts.
 *
 * UNITS: every amount that reaches mobile is in RUPEES, not paise. Vendor
 * priceMin/priceMax come through `num()` in apps/api/src/vendors/service.ts;
 * invoice totals and statement rows are Postgres `decimal` columns that arrive
 * as strings or as `Number(...)`-converted values. Nothing here divides by 100,
 * and nothing should start to without checking the column first — a silent
 * 100x error in a price is the worst class of bug this screen can ship.
 *
 * Note the `Rs.` variant: PDFs in this repo must not use the rupee glyph
 * (PDFKit's standard fonts cannot render it). That rule does not apply to
 * on-screen text, so the UI uses the real symbol.
 */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const INR_NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

/** Full amount with the rupee symbol. Renders an em dash for missing values. */
export function formatINR(amount: number | string | null | undefined): string {
  const n = toFiniteNumber(amount);
  return n === null ? '—' : INR_FORMATTER.format(n);
}

/**
 * Lakh/crore-aware short form for cards, where a full amount would wrap.
 * Uses the Indian grouping the audience actually reads (1.2 L, not 120k).
 */
export function formatINRCompact(
  amount: number | string | null | undefined,
): string {
  const n = toFiniteNumber(amount);
  if (n === null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`;
  if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000, 1)}k`;
  return `${sign}₹${INR_NUMBER_FORMATTER.format(abs)}`;
}

/** A price band, collapsing to a single value when both ends match. */
export function formatPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const lo = toFiniteNumber(min);
  const hi = toFiniteNumber(max);
  if (lo === null && hi === null) return null;
  if (lo !== null && hi === null) return `From ${formatINRCompact(lo)}`;
  if (lo === null && hi !== null) return `Up to ${formatINRCompact(hi)}`;
  if (lo === hi) return formatINRCompact(lo);
  return `${formatINRCompact(lo)} – ${formatINRCompact(hi)}`;
}

/** `YYYY-MM-DD` or ISO -> "12 Mar 2026". Returns null for unparseable input. */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

function trim(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}
