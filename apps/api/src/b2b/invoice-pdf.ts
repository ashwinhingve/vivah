/**
 * B2B Invoice PDF Generator (GST-compliant).
 *
 * Generates professional invoices in PDFKit with:
 * - Smart Shaadi brand colours (Burgundy, Gold, Ivory)
 * - GST calculation (CGST/SGST intra-state, IGST inter-state)
 * - Line items with tax
 * - Amount rendering as "Rs. X.XX" (NEVER the ₹ glyph)
 *
 * Money input: decimal rupees. PDF renders "Rs." prefix.
 */

import PDFDocument from 'pdfkit';
import { BURGUNDY, GOLD, INK, MUTED, PAD } from '../lib/pdf/brand.js';
import { formatRupees, formatDate, renderBuffer } from '../lib/pdf/format.js';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // rupees
  taxRate?: number;  // percentage, default 18
}

export interface InvoicePdfData {
  invoiceNo: string;
  invoiceDate: string; // ISO date
  dueDate?: string;    // ISO date
  from: {
    name: string;
    gstin: string;
    state: string;
    address?: string;
  };
  to: {
    name: string;
    gstin?: string;
    state?: string;
    address?: string;
  };
  lineItems: InvoiceLineItem[];
  discount?: number; // rupees
  taxRate?: number;  // percentage, default 18
  notes?: string;
}

/**
 * Calculate GST tax for an amount.
 */
function calculateTax(
  amount: number,
  customerState: string | undefined,
  platformState: string = 'MH',
  rate: number = 18,
): { cgst: number; sgst: number; igst: number; total: number } {
  const isIntraState = !customerState || customerState.toUpperCase() === platformState.toUpperCase();
  const totalTax = Math.round(amount * rate) / 100;

  if (isIntraState) {
    const half = Math.round(totalTax * 50) / 100;
    return {
      cgst: half,
      sgst: totalTax - half,
      igst: 0,
      total: totalTax,
    };
  }

  return {
    cgst: 0,
    sgst: 0,
    igst: totalTax,
    total: totalTax,
  };
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: PAD });

  return renderBuffer(doc, (doc, { W }) => {
    const innerW = W - PAD * 2;
    let y = doc.y;

    // ── Header: Invoice Title ────────────────────────────────────────────────
    doc.fillColor(BURGUNDY)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('INVOICE', PAD, y, { align: 'left' });
    y = doc.y + 6;

    // Invoice number and date in top-right
    doc.fillColor(INK)
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${data.invoiceNo}`, PAD, y - 24, { align: 'right', width: innerW });
    doc.text(`Date: ${formatDate(data.invoiceDate)}`, PAD, doc.y, { align: 'right', width: innerW });
    if (data.dueDate) {
      doc.text(`Due: ${formatDate(data.dueDate)}`, PAD, doc.y, { align: 'right', width: innerW });
    }

    y = doc.y + 12;

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.lineWidth(1.5)
      .strokeColor(GOLD)
      .moveTo(PAD, y)
      .lineTo(W - PAD, y)
      .stroke();

    y += 16;

    // ── From / To section (two columns) ──────────────────────────────────────
    const colW = (innerW - 20) / 2;
    const fromX = PAD;
    const toX = PAD + colW + 20;

    // FROM
    doc.fillColor(GOLD)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('FROM', fromX, y);
    y = doc.y + 4;

    doc.fillColor(INK)
      .fontSize(10)
      .font('Helvetica')
      .text(data.from.name, fromX, y, { width: colW - 10 });
    y = doc.y + 3;

    doc.fillColor(MUTED)
      .fontSize(9)
      .text(`GSTIN: ${data.from.gstin}`, fromX, y, { width: colW - 10 });
    y = doc.y + 2;

    doc.text(`State: ${data.from.state}`, fromX, y, { width: colW - 10 });
    if (data.from.address) {
      y = doc.y + 2;
      doc.text(data.from.address, fromX, y, { width: colW - 10 });
    }

    // TO (positioned at same y as FROM)
    const toStartY = y - (data.from.address ? 16 : 8);
    doc.fillColor(GOLD)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('BILL TO', toX, toStartY);

    let toY = toStartY + 18;
    doc.fillColor(INK)
      .fontSize(10)
      .font('Helvetica')
      .text(data.to.name, toX, toY, { width: colW - 10 });
    toY = doc.y + 3;

    if (data.to.gstin) {
      doc.fillColor(MUTED)
        .fontSize(9)
        .text(`GSTIN: ${data.to.gstin}`, toX, toY, { width: colW - 10 });
      toY = doc.y + 2;
    }

    if (data.to.state) {
      doc.text(`State: ${data.to.state}`, toX, toY, { width: colW - 10 });
      toY = doc.y + 2;
    }

    if (data.to.address) {
      doc.text(data.to.address, toX, toY, { width: colW - 10 });
    }

    y = Math.max(doc.y, toY) + 16;

    // ── Line Items Table ─────────────────────────────────────────────────────
    doc.lineWidth(0.5).strokeColor(MUTED);
    doc.moveTo(PAD, y).lineTo(W - PAD, y).stroke();
    y += 8;

    const colDescW = innerW * 0.4;
    const colQtyW = innerW * 0.15;
    const colPriceW = innerW * 0.2;
    const colAmtW = innerW * 0.25;

    doc.fillColor(BURGUNDY)
      .fontSize(10)
      .font('Helvetica-Bold');

    doc.text('Description', PAD, y, { width: colDescW });
    doc.text('Qty', PAD + colDescW, y, { width: colQtyW, align: 'right' });
    doc.text('Unit Price', PAD + colDescW + colQtyW, y, { width: colPriceW, align: 'right' });
    doc.text('Amount', PAD + colDescW + colQtyW + colPriceW, y, { width: colAmtW, align: 'right' });

    y = doc.y + 6;

    doc.lineWidth(0.5).strokeColor(MUTED);
    doc.moveTo(PAD, y).lineTo(W - PAD, y).stroke();
    y += 8;

    // Line items
    let subtotal = 0;
    const taxRate = data.taxRate ?? 18;

    for (const item of data.lineItems) {
      const itemAmount = item.quantity * item.unitPrice;
      subtotal += itemAmount;

      doc.fillColor(INK)
        .fontSize(9)
        .font('Helvetica');

      doc.text(item.description, PAD, y, { width: colDescW });
      doc.text(item.quantity.toString(), PAD + colDescW, y, { width: colQtyW, align: 'right' });
      doc.text(formatRupees(item.unitPrice), PAD + colDescW + colQtyW, y, { width: colPriceW, align: 'right' });
      doc.text(formatRupees(itemAmount), PAD + colDescW + colQtyW + colPriceW, y, { width: colAmtW, align: 'right' });

      y = doc.y + 6;
    }

    doc.lineWidth(0.5).strokeColor(MUTED);
    doc.moveTo(PAD, y).lineTo(W - PAD, y).stroke();
    y += 8;

    // ── Totals Section (right-aligned) ───────────────────────────────────────
    const totalsX = PAD + colDescW + colQtyW + colPriceW;
    const totalsW = colAmtW;
    const totalsLabelX = PAD + colDescW + colQtyW;

    doc.fillColor(MUTED)
      .fontSize(9)
      .font('Helvetica');

    const discount = data.discount ?? 0;
    const taxableAmount = subtotal - discount;
    const tax = calculateTax(taxableAmount, data.to.state, 'MH', taxRate);
    const total = taxableAmount + tax.total;

    doc.text('Subtotal:', totalsLabelX, y, { width: colPriceW, align: 'right' });
    doc.text(formatRupees(subtotal), totalsX, y, { width: totalsW, align: 'right' });
    y = doc.y + 4;

    if (discount > 0) {
      doc.text('Discount:', totalsLabelX, y, { width: colPriceW, align: 'right' });
      doc.text(formatRupees(-discount), totalsX, y, { width: totalsW, align: 'right' });
      y = doc.y + 4;
    }

    doc.text('Taxable:', totalsLabelX, y, { width: colPriceW, align: 'right' });
    doc.text(formatRupees(taxableAmount), totalsX, y, { width: totalsW, align: 'right' });
    y = doc.y + 4;

    doc.fillColor(INK)
      .fontSize(9)
      .font('Helvetica');

    if (tax.cgst > 0) {
      doc.text('CGST (9%):', totalsLabelX, y, { width: colPriceW, align: 'right' });
      doc.text(formatRupees(tax.cgst), totalsX, y, { width: totalsW, align: 'right' });
      y = doc.y + 4;

      doc.text('SGST (9%):', totalsLabelX, y, { width: colPriceW, align: 'right' });
      doc.text(formatRupees(tax.sgst), totalsX, y, { width: totalsW, align: 'right' });
      y = doc.y + 4;
    } else if (tax.igst > 0) {
      doc.text('IGST (18%):', totalsLabelX, y, { width: colPriceW, align: 'right' });
      doc.text(formatRupees(tax.igst), totalsX, y, { width: totalsW, align: 'right' });
      y = doc.y + 4;
    }

    y += 2;
    doc.lineWidth(1.5).strokeColor(BURGUNDY);
    doc.moveTo(totalsLabelX, y).lineTo(totalsX + totalsW, y).stroke();
    y += 6;

    doc.fillColor(BURGUNDY)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TOTAL:', totalsLabelX, y, { width: colPriceW, align: 'right' });
    doc.text(formatRupees(total), totalsX, y, { width: totalsW, align: 'right' });

    y = doc.y + 12;

    // ── Notes ────────────────────────────────────────────────────────────────
    if (data.notes && data.notes.trim()) {
      doc.fillColor(MUTED)
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text('Notes:', PAD, y);
      y = doc.y + 2;

      doc.fillColor(INK)
        .font('Helvetica')
        .text(data.notes, PAD, y, { width: innerW });
      y = doc.y + 8;
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    y = doc.page.height - PAD;
    doc.lineWidth(0.5).strokeColor(MUTED);
    doc.moveTo(PAD, y).lineTo(W - PAD, y).stroke();

    y += 6;
    doc.fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text('Smart Shaadi — National Smart Marriage-Centric Event Ecosystem', PAD, y, {
        width: innerW,
        align: 'center',
      });
  });
}
