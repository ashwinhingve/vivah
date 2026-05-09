/**
 * Indian-locale formatters used across the app.
 *
 * INR uses lakhs/crores grouping (₹ 1,50,000 not ₹150,000). Dates use en-IN.
 * Phones render as +91 99999 99999.
 */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const INR_NUMBER_FORMATTER = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });

export function formatINR(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return INR_FORMATTER.format(n);
}

export function formatINRCompact(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 === 0 ? 0 : 2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 2)} L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return `₹${INR_NUMBER_FORMATTER.format(n)}`;
}

export function formatNumberIN(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '—';
  return INR_NUMBER_FORMATTER.format(n);
}

export function formatDateIN(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_FORMATTER.format(d);
}

export function formatDateTimeIN(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_TIME_FORMATTER.format(d);
}

export function formatRelativeIN(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffSec = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return RELATIVE_FORMATTER.format(Math.round(diffSec), 'second');
  if (abs < 3600) return RELATIVE_FORMATTER.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return RELATIVE_FORMATTER.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 604_800) return RELATIVE_FORMATTER.format(Math.round(diffSec / 86_400), 'day');
  if (abs < 2_592_000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 604_800), 'week');
  if (abs < 31_536_000) return RELATIVE_FORMATTER.format(Math.round(diffSec / 2_592_000), 'month');
  return RELATIVE_FORMATTER.format(Math.round(diffSec / 31_536_000), 'year');
}

export function formatPhoneIN(value: string | null | undefined): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const ten = digits.slice(1);
    return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  }
  return value;
}

export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
