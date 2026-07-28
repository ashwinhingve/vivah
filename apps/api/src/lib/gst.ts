/**
 * Shared GST computation (A2-06).
 *
 * Single source of truth so the PERSISTED invoice (payments/invoiceService.ts) and
 * the PRINTED B2B invoice (b2b/invoice-pdf.ts) cannot silently drift and show a
 * customer two different tax figures. Both previously carried byte-identical but
 * separate copies of this formula.
 *
 * The CGST/SGST split guarantees `cgst + sgst === total` by rounding one half and
 * taking the other as the residual. Amounts are decimal RUPEES; rounding is to 2dp.
 * Intra-state (customer state == platform state, or no state) → CGST+SGST;
 * inter-state → IGST.
 */
export interface GstBreakdown {
  cgst:  number;
  sgst:  number;
  igst:  number;
  total: number;
}

export function computeGst(
  taxableValue: number,
  customerState: string | null | undefined,
  platformState = 'MH',
  taxRate = 18,
): GstBreakdown {
  const isIntraState =
    !customerState || customerState.toLowerCase() === platformState.toLowerCase();
  const total = Math.round(taxableValue * taxRate) / 100;

  if (isIntraState) {
    const half = Math.round(total * 50) / 100;
    return { cgst: half, sgst: total - half, igst: 0, total };
  }
  return { cgst: 0, sgst: 0, igst: total, total };
}
