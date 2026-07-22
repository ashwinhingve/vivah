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
 * Result of `POST /payments/subscriptions`.
 *
 * The client never charges a card in-app: the server creates the Razorpay
 * subscription and hands back `shortUrl` — Razorpay's own hosted checkout page.
 * Mobile opens that URL in the system browser and lets Razorpay collect the
 * mandate/payment; the tier flips when Razorpay's webhook reaches the API. This
 * keeps card data off the device AND keeps us out of Apple/Google in-app-billing
 * rules (a payment-gateway subscription, not a digital IAP). `shortUrl` is null
 * only in mock mode without a hosted link, in which case the caller polls
 * `getSubscription()` for the status change instead of opening a browser.
 */
export interface StartSubscriptionResult {
  subscriptionId: string;
  razorpaySubscriptionId: string | null;
  shortUrl: string | null;
  status: string;
}

/**
 * Billing surface.
 *
 * Reads (plans, current subscription, invoices, statement) plus the two
 * subscription mutations. Starting a subscription returns a Razorpay hosted
 * checkout link rather than taking payment in-app — see StartSubscriptionResult.
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

  /**
   * Create a Razorpay subscription for `planCode`. Returns a hosted-checkout
   * `shortUrl` the caller opens in a browser (see StartSubscriptionResult). The
   * server rejects with 409 if the user already has an active/pending one.
   */
  startSubscription(planCode: string): Promise<StartSubscriptionResult> {
    return this.client.post<StartSubscriptionResult>(
      '/api/v1/payments/subscriptions',
      { planCode },
    );
  }

  /**
   * Cancel a subscription. `atCycleEnd` true (default) keeps access until the
   * period ends; false cancels immediately. DELETE carries a body, so this goes
   * through `request` directly rather than the bodyless `delete` helper.
   */
  cancelSubscription(
    subscriptionId: string,
    atCycleEnd = true,
  ): Promise<{ ok: true }> {
    return this.client.request<{ ok: true }>(
      'DELETE',
      `/api/v1/payments/subscriptions/${subscriptionId}`,
      { atCycleEnd },
    );
  }
}
