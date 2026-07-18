/**
 * Smart Shaadi PDF Brand Palette
 *
 * Extracted from invoice-pdf.ts, contract-pdf.ts, invite-pdf.ts
 * to avoid duplication. All PDF generators use this single source of truth.
 */

/** Primary heading colour — burgundy, signals importance */
export const BURGUNDY = '#7B2D42';

/** Accent colour — warm gold, used for dividers and section headers */
export const GOLD = '#C5A47E';

/** Primary text colour — dark ink */
export const INK = '#2E2E38';

/** Secondary text colour — muted gray for footnotes and metadata */
export const MUTED = '#6B6B76';

/** Default page margin (points, 1/72 inch) */
export const PAD = 40;

/** Page background — warm ivory (used by invite-pdf for full-page wash) */
export const IVORY = '#FEFAF6';

/** Secondary accent — peacock teal (used by invite-pdf) */
export const TEAL = '#0E7C7B';
