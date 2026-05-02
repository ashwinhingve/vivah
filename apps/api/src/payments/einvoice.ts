/**
 * E-invoicing (NIC IRP) — generates IRN + QR for B2B invoices over threshold.
 *
 * Stubbed unless EINVOICE_API_KEY set. Real impl needs NIC API endpoint per
 * GST environment (sandbox/prod). All callers must persist (irn, qrCode, ackNo).
 */

import { env } from '../lib/env.js';

export interface EInvoiceResult {
  irn:    string;
  qrCode: string;   // base64-encoded QR image
  ackNo:  string;
  ackDt:  string;   // YYYY-MM-DD HH:mm:ss
}

export interface EInvoicePayload {
  invoiceNumber: string;
  invoiceDate:   Date;
  totalAmount:   number;
  taxableValue:  number;
  cgst:          number;
  sgst:          number;
  igst:          number;
  vendorGstin?:  string;
  buyerGstin?:   string;
  hsnCode?:      string;
  placeOfSupply: string;
}

export function shouldEInvoice(totalAmount: number): boolean {
  return totalAmount >= env.EINVOICE_THRESHOLD;
}

export async function generateEInvoice(payload: EInvoicePayload): Promise<EInvoiceResult> {
  if (env.USE_MOCK_SERVICES || !env.EINVOICE_API_KEY) {
    const seed = `${payload.invoiceNumber}_${Date.now()}`;
    return {
      irn:    `mock-irn-${seed}`,
      qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwAEhgI/wlseKgAAAABJRU5ErkJggg==',
      ackNo:  `mock-ack-${Date.now()}`,
      ackDt:  new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
  }
  // TODO(future): wire to https://einvoice.gst.gov.in/eivital/v1.04/Invoice
  throw new Error('Real e-invoicing endpoint not configured');
}
