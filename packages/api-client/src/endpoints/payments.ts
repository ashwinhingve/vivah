import type { InvoiceRecord, PaymentStatement } from '@smartshaadi/types';
import type { ApiClient } from '../client.js';

/** A row from `GET /payments/subscriptions/plans`. */
export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  tier: string;
  interval: string;
  /** Paise. Render through the money formatter, never as a bare number. */
  amount: number;
  features: unknown;
}

/**
 * `GET /payments/subscriptions/me`. Null when the user has never subscribed —
 * which is the normal state for most users, not an error.
 *
 * The period bounds are serialised Dates: they leave the server as `Date` from
 * Drizzle and arrive here as ISO strings after JSON. Typed as string so callers
 * parse explicitly instead of calling `.getTime()` on a string at runtime.
 */
export interface ActiveSubscription {
  id: string;
  status: string;
  planCode: string;
  tier: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Billing surface — READ-ONLY on mobile, by design.
 *
 * Starting or cancelling a subscription is intentionally not exposed here.
 * Both run through Razorpay, which is still mocked behind USE_MOCK_SERVICES
 * pending the Colonel's merchant account; worse, shipping in-app purchase of a
 * digital subscription would put the app straight into Apple's IAP rules and
 * Google Play Billing. That is a store-policy decision, not a code one, so
 * mobile shows the user what they are on and the web app remains the place to
 * change it.
 *
 * Paths verified against apps/api/src/index.ts:
 *   '/api/v1/payments/statement'     -> statementRouter
 *   '/api/v1/payments/invoices'      -> invoiceRouter
 *   '/api/v1/payments/subscriptions' -> subscriptionsRouter
 */
export class PaymentEndpoints {
  constructor(private readonly client: ApiClient) {}

  /** Invoices belonging to the signed-in user. Server scopes by customerId. */
  getInvoices(): Promise<{ items: InvoiceRecord[] }> {
    return this.client.get<{ items: InvoiceRecord[] }>(
      '/api/v1/payments/invoices',
    );
  }

  getInvoice(invoiceId: string): Promise<InvoiceRecord> {
    return this.client.get<InvoiceRecord>(
      `/api/v1/payments/invoices/${invoiceId}`,
    );
  }

  /**
   * Ledger for a date window. Both bounds are REQUIRED and must be
   * `YYYY-MM-DD`; the server 422s otherwise (StatementQuerySchema), so callers
   * should pass a real range rather than relying on a default.
   */
  getStatement(fromDate: string, toDate: string): Promise<PaymentStatement> {
    return this.client.get<PaymentStatement>('/api/v1/payments/statement', {
      query: { fromDate, toDate },
    });
  }

  getSubscription(): Promise<ActiveSubscription | null> {
    return this.client.get<ActiveSubscription | null>(
      '/api/v1/payments/subscriptions/me',
    );
  }

  /** Public — no session needed. Used to name the user's tier on screen. */
  getPlans(): Promise<SubscriptionPlan[]> {
    return this.client.get<SubscriptionPlan[]>(
      '/api/v1/payments/subscriptions/plans',
    );
  }
}
