'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { z } from 'zod';
import { useCartStore } from '@/store/useCartStore';
import { track } from '@/lib/analytics';
import type { PromoApplicationResult } from '@smartshaadi/types';

const ShippingSchema = z.object({
  name:    z.string().min(2, 'Name is required'),
  phone:   z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  address: z.string().min(5, 'Address is required'),
  city:    z.string().min(2, 'City is required'),
  state:   z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
});

type ShippingFields = z.infer<typeof ShippingSchema>;
type FieldErrors    = Partial<Record<keyof ShippingFields, string>>;

const INITIAL: ShippingFields = {
  name:    '',
  phone:   '',
  address: '',
  city:    '',
  state:   '',
  pincode: '',
};

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export function CheckoutForm() {
  const router     = useRouter();
  const t          = useTranslations('store.checkout');
  const items      = useCartStore(s => s.items);
  const totalPrice = useCartStore(s => s.totalPrice);
  const clearCart  = useCartStore(s => s.clearCart);

  const [form,         setForm]         = useState<ShippingFields>(INITIAL);
  const [errors,       setErrors]       = useState<FieldErrors>({});
  const [submitting,   setSubmitting]   = useState(false);
  const [serverError,  setServerError]  = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [mounted,      setMounted]      = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  // Promo code state
  const [promoOpen,    setPromoOpen]    = useState(false);
  const [promoCode,    setPromoCode]    = useState('');
  const [promoApplying,setPromoApplying]= useState(false);
  const [promoError,   setPromoError]   = useState<string | null>(null);
  const [promoResult,  setPromoResult]  = useState<PromoApplicationResult | null>(null);

  useEffect(() => {
    setMounted(true);
    const subtotal = totalPrice();
    const itemCount = items.length;
    track('store_checkout_started', { itemCount, totalPaise: Math.round(subtotal * 100) });
  }, []);

  async function applyPromo() {
    setPromoError(null);
    if (!promoCode.trim()) {
      setPromoError(t('errorPromoRequired'));
      return;
    }
    setPromoApplying(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/payments/promos/quote`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), amount: subtotal, scope: 'STORE' }),
      });
      const json = (await res.json()) as { success: boolean; data?: PromoApplicationResult; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setPromoError(json.error ?? t('errorPromoInvalid'));
        setPromoResult(null);
        return;
      }
      setPromoResult(json.data);
    } catch {
      setPromoError(t('errorNetwork'));
    } finally {
      setPromoApplying(false);
    }
  }

  function removePromo() {
    setPromoResult(null);
    setPromoCode('');
    setPromoError(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof ShippingFields]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const result = ShippingSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      result.error.issues.forEach(err => {
        const key = err.path[0] as keyof ShippingFields;
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (items.length === 0) {
      setServerError(t('cartEmpty'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/store/orders`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddress: result.data,
          items: items.map(i => ({
            productId: i.productId,
            quantity:  i.quantity,
          })),
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?:   { order: { id: string }; razorpayOrderId: string | null };
        error?:  string;
      };

      if (!res.ok || !json.success) {
        setServerError(json.error ?? t('errorCreateOrder'));
        return;
      }

      const orderId = json.data?.order.id;
      clearCart();
      setOrderSuccess(orderId ?? '');

      // Track order completion
      track('store_order_completed', {
        orderId: orderId ?? '',
        itemCount: items.length,
        totalPaise: Math.round((promoResult ? promoResult.finalAmount : subtotal) * 100),
      });

      // Mock Razorpay capture — flip PLACED → CONFIRMED so the demo flow shows
      // a confirmed order. Real Razorpay replaces this with the client-side
      // checkout widget + webhook confirmation at cutover. Fire-and-forget.
      if (orderId) {
        fetch(`${API_URL}/api/v1/dev/confirm-mock-payment`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ orderId }),
        }).catch(() => { /* non-critical — order still PLACED if this fails */ });
      }

      // Brief success banner then navigate
      setTimeout(() => {
        if (orderId) {
          router.push(`/store/orders/${orderId}`);
        } else {
          router.push('/store/orders');
        }
      }, 1500);
    } catch {
      setServerError(t('errorConnectionError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (orderSuccess !== null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-heading text-primary text-xl font-bold">{t('successTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('successMessage')}</p>
      </div>
    );
  }

  const subtotal = totalPrice();

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        {/* Shipping form */}
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-4">
          <h2 className="font-heading text-primary font-semibold text-lg">{t('shippingDetails')}</h2>

        {serverError && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {serverError}
          </div>
        )}

          {/* Name */}
          <Field
            label={t('labels.fullName')}
            name="name"
            type="text"
            placeholder="Ravi Kumar"
            value={form.name}
            error={errors.name}
            onChange={handleChange}
          />

          {/* Phone */}
          <Field
            label={t('labels.mobileNumber')}
            name="phone"
            type="tel"
            placeholder="9876543210"
            value={form.phone}
            error={errors.phone}
            onChange={handleChange}
          />

          {/* Address */}
          <Field
            label={t('labels.address')}
            name="address"
            type="text"
            placeholder="123, MG Road, Shivaji Nagar"
            value={form.address}
            error={errors.address}
            onChange={handleChange}
          />

          {/* City + State row */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('labels.city')}
              name="city"
              type="text"
              placeholder="Pune"
              value={form.city}
              error={errors.city}
              onChange={handleChange}
            />
            <Field
              label={t('labels.state')}
              name="state"
              type="text"
              placeholder="Maharashtra"
              value={form.state}
              error={errors.state}
              onChange={handleChange}
            />
          </div>

          {/* Pincode */}
          <Field
            label={t('labels.pincode')}
            name="pincode"
            type="text"
            placeholder="411001"
            value={form.pincode}
            error={errors.pincode}
            onChange={handleChange}
          />

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full min-h-[44px] bg-teal text-white font-semibold rounded-lg text-sm hover:bg-teal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {submitting ? t('placingOrder') : t('placeOrder')}
          </button>
        </form>

        {/* Order summary sidebar — desktop only */}
        <div className="hidden md:block bg-surface border border-gold/20 rounded-2xl p-4 h-fit sticky top-24">
          <h2 className="font-heading text-primary font-semibold text-base mb-3">{t('orderSummary')}</h2>

          <div className="space-y-2.5 mb-4">
            {items.map(item => (
              <div key={item.productId} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[140px]">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-medium text-foreground ml-2 flex-shrink-0">
                  {mounted ? `₹${(item.price * item.quantity).toLocaleString('en-IN')}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm border-t border-gold/20 pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('subtotal')}</span>
              <span className="text-foreground">{mounted ? `₹${subtotal.toLocaleString('en-IN')}` : '—'}</span>
            </div>
            {promoResult && (
              <div className="flex justify-between text-success">
                <span className="flex items-center gap-1">
                  {promoResult.code}
                  <button
                    type="button"
                    onClick={removePromo}
                    className="text-2xs text-muted-foreground hover:text-destructive ml-1"
                    aria-label={t('removePromo')}
                  >
                    ✕
                  </button>
                </span>
                <span>−{mounted ? `₹${promoResult.discount.toLocaleString('en-IN')}` : '—'}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{t('shipping')}</span>
              <span className="text-success">{t('free')}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground border-t border-gold/20 pt-2">
              <span>{t('total')}</span>
              <span className="text-teal">
                {mounted ? `₹${(promoResult ? promoResult.finalAmount : subtotal).toLocaleString('en-IN')}` : '—'}
              </span>
            </div>
          </div>

          {/* Promo code section */}
          <div className="mt-4 border-t border-gold/20 pt-3">
            {!promoResult ? (
              <>
                <button
                  type="button"
                  onClick={() => setPromoOpen(v => !v)}
                  className="text-xs font-medium text-teal hover:underline"
                >
                  {promoOpen ? t('hidePromo') : t('havePromo')}
                </button>
                {promoOpen && (
                  <div className="mt-2 space-y-2">
                    {promoError && (
                      <p className="text-xs text-destructive">{promoError}</p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        placeholder={t('promoPlaceholder')}
                        className="flex-1 h-9 rounded-lg border border-gold/30 bg-surface px-3 text-xs font-mono focus:outline-none focus:border-teal uppercase"
                      />
                      <button
                        type="button"
                        onClick={applyPromo}
                        disabled={promoApplying}
                        className="h-9 px-3 rounded-lg bg-teal text-white text-xs font-semibold disabled:opacity-60"
                      >
                        {promoApplying ? '…' : t('promoApply')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-success font-medium">
                {t('promoSaving', { amount: mounted ? promoResult.discount.toLocaleString('en-IN') : '—' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky summary — visible only below md */}
      {mounted && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-gold/20 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="w-full flex items-center justify-between min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <div className="text-left">
                <p className="text-xs text-muted-foreground">{t('mobileSummary.title')}</p>
                <p className="font-semibold text-sm text-foreground">₹{(promoResult ? promoResult.finalAmount : subtotal).toLocaleString('en-IN')}</p>
              </div>
              <span className="text-xs bg-teal/15 text-teal px-2 py-1 rounded-full">
                {t('mobileSummary.itemCount', { count: items.length })}
              </span>
            </div>
            <svg className={`h-5 w-5 text-muted-foreground transition-transform ${mobileOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {mobileOpen && (
            <div className="mt-3 pt-3 border-t border-gold/20 space-y-2 max-h-48 overflow-y-auto">
              {items.map(item => (
                <div key={item.productId} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[180px]">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-foreground ml-2 flex-shrink-0">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-gold/20 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('subtotal')}</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {promoResult && (
                  <div className="flex justify-between text-success">
                    <span>{promoResult.code}</span>
                    <span>−₹{promoResult.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t('shipping')}</span>
                  <span className="text-success">{t('free')}</span>
                </div>
                <div className="flex justify-between font-bold text-foreground border-t border-gold/20 pt-1.5">
                  <span>{t('total')}</span>
                  <span className="text-teal">
                    ₹{(promoResult ? promoResult.finalAmount : subtotal).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile padding to prevent content overlap */}
      <div className="md:hidden h-32" />
    </>

  );
}

// ── Internal field component ──────────────────────────────────────────────────

interface FieldProps {
  label:       string;
  name:        string;
  type:        string;
  placeholder: string;
  value:       string;
  error?:      string;
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function Field({ label, name, type, placeholder, value, error, onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={[
          'w-full px-3 py-2.5 text-sm bg-surface border rounded-lg outline-none min-h-[44px] transition-colors',
          error
            ? 'border-destructive/60 focus:ring-2 focus:ring-red-200'
            : 'border-gold/30 focus:ring-2 focus:ring-teal/30 focus:border-teal',
        ].join(' ')}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
