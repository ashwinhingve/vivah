/**
 * Contract PDF Generator — smart-shaadi branded
 *
 * Generates professional contracts in PDFKit with:
 * - Smart Shaadi brand colours (Burgundy, Gold, Ivory)
 * - Title, parties, sections, signature block
 * - Content hash in footer for audit chain
 * - Amounts rendered as "Rs. X.XX" (NEVER the ₹ glyph — Helvetica bug)
 *
 * Sections are pre-rendered as plain text; this function just layouts them.
 */

import PDFDocument from 'pdfkit';
import { BURGUNDY, GOLD, INK, MUTED, PAD } from '../lib/pdf/brand.js';
import { renderBuffer } from '../lib/pdf/format.js';
import type { ContractSection } from './templates.js';

// Amounts are pre-formatted as "Rs. X.XX" inside the rendered template sections
// (never the ₹ glyph — Helvetica bug), so this layout function only positions text.

export interface ContractPdfData {
  title: string;
  parties: { name: string; role: string }[];
  sections: ContractSection[];
  contentHash: string;
  generatedDate: string;
}

export function generateContractPdf(data: ContractPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: PAD });

  return renderBuffer(doc, (doc, { W }) => {
    const innerW = W - PAD * 2;
    let y = doc.y;

    // ── Header: Contract Title ────────────────────────────────────────────────
    doc.fillColor(BURGUNDY)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.title, PAD, y, { align: 'center' });
    y = doc.y + 12;

    // Generated date in top-right
    doc.fillColor(MUTED)
      .fontSize(9)
      .font('Helvetica')
      .text(`Generated: ${data.generatedDate}`, PAD, y - 20, { align: 'right', width: innerW });
    y = doc.y + 8;

    // ── Divider ──────────────────────────────────────────────────────────────
    doc.lineWidth(1.5)
      .strokeColor(GOLD)
      .moveTo(PAD, y)
      .lineTo(W - PAD, y)
      .stroke();
    y += 16;

    // ── Parties Section ──────────────────────────────────────────────────────
    doc.fillColor(GOLD)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('PARTIES TO THIS AGREEMENT', PAD, y);
    y = doc.y + 4;

    doc.fillColor(INK)
      .fontSize(10)
      .font('Helvetica');

    for (const party of data.parties) {
      doc.text(`${party.role}: ${party.name}`, PAD + 10, y);
      y = doc.y + 3;
    }

    y += 8;

    // ── Document Sections ────────────────────────────────────────────────────
    for (const section of data.sections) {
      // Section title
      doc.fillColor(BURGUNDY)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(section.title, PAD, y);
      y = doc.y + 4;

      // Section content
      doc.fillColor(INK)
        .fontSize(9)
        .font('Helvetica');

      for (const line of section.content) {
        // Replace ₹ with Rs. to avoid Helvetica rendering issues
        const safeLine = line.replace(/₹/g, 'Rs.');
        doc.text(safeLine, PAD + 10, y, { width: innerW - 20, align: 'left' });
        y = doc.y + 2;
      }

      y += 6;
    }

    // ── Signature Block ──────────────────────────────────────────────────────
    y += 8;
    doc.lineWidth(0.5)
      .strokeColor(MUTED)
      .moveTo(PAD, y)
      .lineTo(W - PAD, y)
      .stroke();

    y += 12;
    doc.fillColor(GOLD)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SIGNATURES', PAD, y);
    y = doc.y + 8;

    // Two signature lines for parties
    const sigColW = (innerW - 20) / 2;
    const sig1X = PAD;
    const sig2X = PAD + sigColW + 20;

    for (const [i, party] of data.parties.entries()) {
      const sigX = i === 0 ? sig1X : sig2X;

      doc.fillColor(INK)
        .fontSize(9)
        .font('Helvetica')
        .text('_______________________', sigX, y);
      y = doc.y + 2;

      doc.fillColor(MUTED)
        .fontSize(8)
        .text(`${party.role}`, sigX, y);
      y = doc.y + 12;
    }

    // ── Footer with Content Hash ─────────────────────────────────────────────
    y = doc.page.height - 40;
    doc.lineWidth(0.5)
      .strokeColor(MUTED)
      .moveTo(PAD, y)
      .lineTo(W - PAD, y)
      .stroke();

    y += 6;
    doc.fillColor(MUTED)
      .fontSize(7)
      .font('Helvetica')
      .text(`Smart Shaadi — National Smart Marriage-Centric Event Ecosystem`, PAD, y, {
        width: innerW,
        align: 'center',
      });
    y = doc.y + 1;

    doc.text(`Content Hash (SHA256): ${data.contentHash.substring(0, 16)}...`, PAD, y, {
      width: innerW,
      align: 'center',
    });
  });
}
