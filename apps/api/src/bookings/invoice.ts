/**
 * Invoice PDF generator using pdfkit.
 * Returns a Buffer that can be streamed directly as application/pdf.
 */

import PDFDocument from 'pdfkit';
import type { InvoiceData } from '@smartshaadi/types';

// VivahOS brand colours
const ROYAL_BURGUNDY = '#7B2D42';
const TEXT_DARK      = '#1A1A1A';
const TEXT_MUTED     = '#6B7280';
const DIVIDER        = '#E5E7EB';

/**
 * Format a number as Indian Rupees with comma separators.
 * e.g. 125000 → "₹1,25,000"
 */
function formatInr(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function generateInvoice(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ───────────────────────────────────────────────────────────────
    doc
      .fillColor(ROYAL_BURGUNDY)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('VivahOS', 50, 50);

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(10)
      .font('Helvetica')
      .text('Smart Shaadi — National Marriage Ecosystem', 50, 85);

    // Invoice title on the right
    doc
      .fillColor(ROYAL_BURGUNDY)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('TAX INVOICE', 350, 50, { align: 'right', width: 200 });

    // ── Invoice meta ─────────────────────────────────────────────────────────
    const metaTop = 110;
    doc
      .fillColor(TEXT_DARK)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice No:', 350, metaTop, { continued: true })
      .font('Helvetica')
      .fillColor(TEXT_MUTED)
      .text(` ${data.invoiceNo}`);

    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .text('Date:', 350, metaTop + 15, { continued: true })
      .font('Helvetica')
      .fillColor(TEXT_MUTED)
      .text(` ${data.invoiceDate}`);

    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .text('Booking ID:', 350, metaTop + 30, { continued: true })
      .font('Helvetica')
      .fillColor(TEXT_MUTED)
      .text(` ${data.bookingId}`);

    // ── Divider ──────────────────────────────────────────────────────────────
    doc
      .moveTo(50, 155)
      .lineTo(545, 155)
      .strokeColor(DIVIDER)
      .stroke();

    // ── Bill From / To ───────────────────────────────────────────────────────
    const billTop = 170;

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('FROM', 50, billTop)
      .fillColor(TEXT_DARK)
      .fontSize(11)
      .text(data.vendorName, 50, billTop + 14);

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('TO', 350, billTop)
      .fillColor(TEXT_DARK)
      .fontSize(11)
      .text(data.customerName, 350, billTop + 14);

    // ── Event date ───────────────────────────────────────────────────────────
    doc
      .fillColor(TEXT_MUTED)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('EVENT DATE', 50, billTop + 40)
      .fillColor(TEXT_DARK)
      .fontSize(10)
      .font('Helvetica')
      .text(data.eventDate, 50, billTop + 54);

    // ── Services table header ─────────────────────────────────────────────────
    const tableTop = 270;

    doc
      .rect(50, tableTop, 495, 22)
      .fillColor(ROYAL_BURGUNDY)
      .fill();

    doc
      .fillColor('#FFFFFF')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Service', 60, tableTop + 6)
      .text('Amount', 460, tableTop + 6, { align: 'right', width: 75 });

    // ── Service line items ────────────────────────────────────────────────────
    const amountPerService =
      data.serviceNames.length > 0
        ? data.totalAmount / data.serviceNames.length
        : data.totalAmount;

    let rowY = tableTop + 30;

    data.serviceNames.forEach((name, i) => {
      const bg = i % 2 === 0 ? '#FAFAFA' : '#FFFFFF';
      doc
        .rect(50, rowY - 4, 495, 20)
        .fillColor(bg)
        .fill();

      doc
        .fillColor(TEXT_DARK)
        .fontSize(10)
        .font('Helvetica')
        .text(name, 60, rowY)
        .text(formatInr(amountPerService), 460, rowY, { align: 'right', width: 75 });

      rowY += 22;
    });

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalsY = rowY + 10;

    doc
      .moveTo(50, totalsY)
      .lineTo(545, totalsY)
      .strokeColor(DIVIDER)
      .stroke();

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal', 350, totalsY + 10)
      .fillColor(TEXT_DARK)
      .text(formatInr(data.totalAmount), 460, totalsY + 10, { align: 'right', width: 75 });

    doc
      .fillColor(TEXT_MUTED)
      .text('Amount Paid', 350, totalsY + 28)
      .fillColor(TEXT_DARK)
      .text(formatInr(data.paidAmount), 460, totalsY + 28, { align: 'right', width: 75 });

    const balance = data.totalAmount - data.paidAmount;

    doc
      .moveTo(350, totalsY + 48)
      .lineTo(545, totalsY + 48)
      .strokeColor(DIVIDER)
      .stroke();

    doc
      .fillColor(ROYAL_BURGUNDY)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Balance Due', 350, totalsY + 55)
      .text(formatInr(balance), 460, totalsY + 55, { align: 'right', width: 75 });

    // ── Footer ────────────────────────────────────────────────────────────────
    doc
      .moveTo(50, 760)
      .lineTo(545, 760)
      .strokeColor(DIVIDER)
      .stroke();

    doc
      .fillColor(TEXT_MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text('Powered by VivahOS — Smart Shaadi', 50, 768, { align: 'center', width: 495 })
      .text('For disputes contact support@vivah.os | This is a computer-generated invoice.', 50, 782, {
        align: 'center',
        width: 495,
      });

    doc.end();
  });
}
