/**
 * Smart Shaadi PDF Format Helpers
 *
 * Extracted from invoice-pdf.ts and invite-pdf.ts to consolidate
 * shared formatting logic and the PDFKit Promise<Buffer> rendering pattern.
 */

/**
 * Format rupee amount as "Rs. X,XX,XXX.XX" with Indian lakh/crore grouping (A2-07).
 *
 * CRITICAL: Always outputs "Rs." ASCII prefix, never the ₹ glyph.
 * PDFKit's Helvetica font renders ₹ incorrectly (renders as blank or misaligned);
 * the ASCII fallback is the documented workaround across all PDF generators.
 *
 * Grouping is applied to the integer part only, on top of `toFixed(2)`, so the
 * 2dp rounding behaviour is unchanged — only thousands/lakh separators are added
 * (e.g. 1234567.89 → "Rs. 12,34,567.89").
 */
export function formatRupees(amount: number): string {
  const fixed = amount.toFixed(2);
  const negative = fixed.startsWith('-');
  const [intPart, decPart] = fixed.replace('-', '').split('.');
  const grouped = Number(intPart).toLocaleString('en-IN');
  return `Rs. ${negative ? '-' : ''}${grouped}.${decPart}`;
}

/**
 * Format ISO date string to readable month/day/year format
 *
 * Input:  '2026-05-10'
 * Output: '10 May 2026'
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Render a PDFKit document to Buffer, handling all promise/event wiring.
 *
 * Used by all PDF generators to abstract the boilerplate of:
 *   - collecting data chunks from the 'data' event
 *   - resolving when 'end' fires
 *   - rejecting on 'error'
 *   - calling doc.end() to trigger the streams
 *
 * @param doc PDFKit document, already configured (size, margin, etc.)
 * @param render Callback that layouts content onto the document.
 *               Receives the document object and a helper: { W, H } = page dimensions.
 * @returns Promise<Buffer> — the rendered PDF bytes
 *
 * @example
 *   const buffer = await renderBuffer(doc, ({ W }) => {
 *     doc.fontSize(28).text('Hello', 40, 40);
 *   });
 */
export async function renderBuffer(
  doc: PDFKit.PDFDocument,
  render: (doc: PDFKit.PDFDocument, helpers: { W: number; H: number }) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;

    render(doc, { W, H });
    doc.end();
  });
}
