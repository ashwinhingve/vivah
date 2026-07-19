import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/**
 * Billing data for the signed-in user. All read-only — see the note on
 * PaymentEndpoints for why mobile does not start or cancel a subscription.
 */

export function useInvoices() {
  return useQuery({
    queryKey: ['payments', 'invoices'],
    queryFn: () => api.payments.getInvoices(),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ['payments', 'subscription'],
    queryFn: () => api.payments.getSubscription(),
  });
}

/**
 * Ledger for a window ending today.
 *
 * The range is computed ONCE per mount and passed in as a key, not derived
 * inside `queryFn`. Deriving it inside would make the key stable while the
 * requested window silently slid forward, so a cached page could show one
 * range's totals under another range's heading.
 */
export function useStatement(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['payments', 'statement', fromDate, toDate],
    queryFn: () => api.payments.getStatement(fromDate, toDate),
    enabled: Boolean(fromDate) && Boolean(toDate),
  });
}

/** `YYYY-MM-DD` in local time. `toISOString()` would shift IST back a day. */
export function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The default window the billing screen opens on: the last 90 days. */
export function defaultStatementRange(now: Date = new Date()): {
  fromDate: string;
  toDate: string;
} {
  const from = new Date(now);
  from.setDate(from.getDate() - 90);
  return { fromDate: toDateParam(from), toDate: toDateParam(now) };
}
