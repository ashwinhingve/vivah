/**
 * Currency unit conversions for the Razorpay boundary.
 *
 * Internal storage is rupees (decimal(12,2)). Razorpay APIs require the
 * smallest currency unit (paise for INR). Every value crossing into
 * createOrder / createRefund / transferToVendor MUST go through
 * rupeesToPaise — silent unit confusion mis-transferred 100× amounts in
 * production (P0 audit, 2026-05-04).
 */

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new Error(`rupeesToPaise: non-finite input ${rupees}`);
  }
  if (rupees < 0) {
    throw new Error(`rupeesToPaise: negative input ${rupees}`);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) {
    throw new Error(`paiseToRupees: non-finite input ${paise}`);
  }
  return paise / 100;
}
