'use client';

import { useEffect, useRef } from 'react';

interface RazorpayCheckoutProps {
  /** Razorpay order ID returned from /api/v1/payments/order */
  orderId:        string;
  amount:         number;
  currency?:      string;
  bookingId:      string;
  customerName?:  string;
  customerEmail?: string;
  customerPhone?: string;
  /** subscription_id — if provided, opens Subscriptions checkout instead of Orders */
  subscriptionId?: string;
  /** Save payment method as token after successful charge */
  saveMethod?:    boolean;
  onSuccess: (response: { paymentId: string; orderId: string; signature: string }) => void;
  onFailure: (error: { code: string; description: string }) => void;
  onDismiss?: () => void;
  buttonLabel?: string;
  className?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    Razorpay?: new (options: unknown) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

function loadScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function RazorpayCheckout({
  orderId,
  amount,
  currency = 'INR',
  bookingId,
  customerName,
  customerEmail,
  customerPhone,
  subscriptionId,
  saveMethod,
  onSuccess,
  onFailure,
  onDismiss,
  buttonLabel = 'Pay now',
  className,
  disabled,
}: RazorpayCheckoutProps) {
  const opening = useRef(false);

  useEffect(() => {
    void loadScript();
  }, []);

  async function handleClick(): Promise<void> {
    if (opening.current || disabled) return;
    opening.current = true;
    const ok = await loadScript();
    if (!ok || !window.Razorpay) {
      onFailure({ code: 'SCRIPT_LOAD_FAILED', description: 'Razorpay SDK could not load' });
      opening.current = false;
      return;
    }

    const key = process.env['NEXT_PUBLIC_RAZORPAY_KEY_ID'];
    if (!key) {
      onFailure({ code: 'NO_KEY', description: 'NEXT_PUBLIC_RAZORPAY_KEY_ID not configured' });
      opening.current = false;
      return;
    }

    const options: Record<string, unknown> = {
      key,
      amount:   amount * 100,            // Razorpay expects paise
      currency,
      name:     'Smart Shaadi',
      description: subscriptionId ? 'Subscription' : `Booking ${bookingId.slice(0, 8)}`,
      order_id: orderId,
      ...(subscriptionId ? { subscription_id: subscriptionId } : {}),
      prefill: {
        name:    customerName  ?? '',
        email:   customerEmail ?? '',
        contact: customerPhone ?? '',
      },
      notes:   { bookingId, ...(subscriptionId ? { subscriptionId } : {}) },
      theme:   { color: 'var(--color-primary)' },
      ...(saveMethod ? { remember_customer: true } : {}),
      modal:   {
        ondismiss: () => { onDismiss?.(); opening.current = false; },
      },
      handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        onSuccess({
          paymentId: response.razorpay_payment_id,
          orderId:   response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
        opening.current = false;
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp: unknown) => {
      const e = (resp as { error?: { code?: string; description?: string } }).error;
      onFailure({
        code:        e?.code        ?? 'PAYMENT_FAILED',
        description: e?.description ?? 'Payment failed',
      });
      opening.current = false;
    });
    rzp.open();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={
        className ??
        'min-h-[44px] inline-flex items-center justify-center px-5 rounded-lg bg-primary text-white font-medium shadow-sm hover:bg-teal transition-colors disabled:opacity-50'
      }
    >
      {buttonLabel}
    </button>
  );
}
