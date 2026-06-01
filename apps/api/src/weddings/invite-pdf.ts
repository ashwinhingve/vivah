/**
 * Digital invitation PDF generator (pdfkit).
 *
 * Flowing layout — unlike bookings/invoice.ts this does NOT use fixed
 * y-coordinates, so any number of ceremonies renders without overrunning.
 * Brand palette mirrors the Smart Shaadi design tokens.
 */
import PDFDocument from 'pdfkit';

export interface InviteCeremony {
  type: string;
  date: string | null;
  startTime: string | null;
  venue: string | null;
}

export interface InvitePdfData {
  templateId: string;
  brideName: string | null;
  groomName: string | null;
  title: string | null;
  message: string | null;
  weddingDate: string | null;
  muhuratName: string | null;
  muhuratTithi: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  ceremonies: InviteCeremony[];
}

// Smart Shaadi brand colours (globals.css @theme tokens).
const BURGUNDY = '#7B2D42';
const GOLD = '#C5A47E';
const TEAL = '#0E7C7B';
const IVORY = '#FEFAF6';
const INK = '#2E2E38';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function generateInvitePdf(data: InvitePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const PAD = 46;
    const innerW = W - PAD * 2;

    // Background wash + gold frame.
    doc.rect(0, 0, W, H).fill(IVORY);
    doc.lineWidth(1.5).strokeColor(GOLD).rect(18, 18, W - 36, H - 36).stroke();

    let y = 70;

    doc.fillColor(GOLD).fontSize(11).font('Helvetica')
      .text('TOGETHER WITH THEIR FAMILIES', PAD, y, { width: innerW, align: 'center', characterSpacing: 2 });
    y += 34;

    const bride = (data.brideName ?? '').trim();
    const groom = (data.groomName ?? '').trim();
    const coupleLine = bride && groom
      ? `${bride}  &  ${groom}`
      : (data.title ?? (bride || groom || 'Our Wedding'));
    doc.fillColor(BURGUNDY).font('Times-Bold').fontSize(28)
      .text(coupleLine, PAD, y, { width: innerW, align: 'center' });
    y = doc.y + 10;

    if (data.message && data.message.trim()) {
      doc.fillColor(INK).font('Times-Italic').fontSize(12)
        .text(data.message.trim(), PAD, y, { width: innerW, align: 'center' });
      y = doc.y + 14;
    } else {
      doc.fillColor(INK).font('Times-Italic').fontSize(12)
        .text('request the pleasure of your company', PAD, y, { width: innerW, align: 'center' });
      y = doc.y + 14;
    }

    doc.lineWidth(0.8).strokeColor(GOLD)
      .moveTo(W / 2 - 40, y).lineTo(W / 2 + 40, y).stroke();
    y += 22;

    if (data.weddingDate) {
      doc.fillColor(TEAL).font('Times-Bold').fontSize(16)
        .text(formatDate(data.weddingDate), PAD, y, { width: innerW, align: 'center' });
      y = doc.y + 4;
    }
    const muhuratBits = [data.muhuratName, data.muhuratTithi].filter(Boolean).join(' · ');
    if (muhuratBits) {
      doc.fillColor(INK).font('Helvetica').fontSize(10)
        .text(`Muhurat: ${muhuratBits}`, PAD, y, { width: innerW, align: 'center' });
      y = doc.y + 6;
    }

    const venueLine = [data.venueName, data.venueCity].filter(Boolean).join(', ');
    if (venueLine) {
      doc.fillColor(BURGUNDY).font('Helvetica-Bold').fontSize(11)
        .text(venueLine, PAD, y + 6, { width: innerW, align: 'center' });
      y = doc.y + 2;
    }
    if (data.venueAddress) {
      doc.fillColor(INK).font('Helvetica').fontSize(9)
        .text(data.venueAddress, PAD, y, { width: innerW, align: 'center' });
      y = doc.y + 8;
    }

    if (data.ceremonies.length > 0) {
      y += 10;
      doc.lineWidth(0.8).strokeColor(GOLD)
        .moveTo(W / 2 - 40, y).lineTo(W / 2 + 40, y).stroke();
      y += 16;
      doc.fillColor(GOLD).font('Helvetica').fontSize(10)
        .text('CELEBRATIONS', PAD, y, { width: innerW, align: 'center', characterSpacing: 2 });
      y = doc.y + 10;

      for (const c of data.ceremonies) {
        const label = titleCase(c.type);
        const when = [formatDate(c.date), c.startTime].filter(Boolean).join(' · ');
        const where = c.venue ?? '';
        doc.fillColor(BURGUNDY).font('Times-Bold').fontSize(12)
          .text(label, PAD, y, { width: innerW, align: 'center' });
        y = doc.y + 1;
        const sub = [when, where].filter(Boolean).join('  —  ');
        if (sub) {
          doc.fillColor(INK).font('Helvetica').fontSize(9)
            .text(sub, PAD, y, { width: innerW, align: 'center' });
          y = doc.y;
        }
        y += 8;
      }
    }

    doc.end();
  });
}
