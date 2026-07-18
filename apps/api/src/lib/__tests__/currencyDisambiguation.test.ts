/**
 * Currency disambiguation + PDF-safety (Phase 7 Sprint G, Unit 7.2 follow-up).
 *
 * Unit 7.2 is the first time one user can see prices denominated in several
 * different currencies at once, which turns two previously-harmless behaviours
 * into real defects:
 *
 *   1. In their native locales, USD/CAD/AUD/SGD all render as a bare "$1,234.56".
 *      Fine in isolation; ambiguous the moment they appear in the same list.
 *   2. The PDF/ASCII path substituted symbols blindly ('$' -> 'US$'), which
 *      MISLABELLED Canadian dollars as US dollars on an invoice, and could not
 *      handle locales that trail the symbol (de-DE) or wrap it in RTL marks (ar-AE).
 */
import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyAscii } from '../currency.js';

const AMOUNT = 123456789n; // 1,234,567.89 in major units

describe('currency disambiguation — the $ family must not collide', () => {
  it('renders USD, CAD, AUD and SGD as four distinguishable strings', () => {
    const rendered = (['USD', 'CAD', 'AUD', 'SGD'] as const).map((c) => formatMoney(AMOUNT, c));
    expect(new Set(rendered).size).toBe(4);
  });

  it('marks the non-US dollars explicitly', () => {
    expect(formatMoney(AMOUNT, 'CAD')).toContain('CA$');
    expect(formatMoney(AMOUNT, 'AUD')).toContain('A$');
    expect(formatMoney(AMOUNT, 'SGD')).toContain('SGD');
    // USD keeps the plain, expected symbol.
    expect(formatMoney(AMOUNT, 'USD')).toContain('$');
    expect(formatMoney(AMOUNT, 'USD')).not.toContain('CA$');
  });

  it('leaves INR lakh/crore grouping intact', () => {
    expect(formatMoney(AMOUNT, 'INR')).toBe('₹12,34,567.89');
  });
});

describe('PDF/ASCII output is truthful and printable', () => {
  it('never labels Canadian dollars as US dollars', () => {
    const cad = formatMoneyAscii(AMOUNT, 'CAD');
    expect(cad).toContain('CA$');
    expect(cad).not.toContain('US$');
  });

  it('emits Rs. for INR (Helvetica has no rupee glyph)', () => {
    expect(formatMoneyAscii(AMOUNT, 'INR')).toBe('Rs.12,34,567.89');
  });

  it('carries no non-ASCII byte for any supported currency', () => {
    // The whole point of this path: a PDF font must be able to draw every char.
    for (const c of ['INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD'] as const) {
      const out = formatMoneyAscii(AMOUNT, c);
      // eslint-disable-next-line no-control-regex
      expect(out, `${c} -> ${JSON.stringify(out)}`).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('handles the trailing-symbol locale (EUR) and the RTL locale (AED)', () => {
    // de-DE renders "1.234.567,89 €" and ar-AE wraps in U+200F marks — neither
    // can be fixed by stripping a prefix.
    expect(formatMoneyAscii(AMOUNT, 'EUR')).toBe('EUR1.234.567,89');
    expect(formatMoneyAscii(AMOUNT, 'AED')).toContain('AED');
    expect(formatMoneyAscii(AMOUNT, 'AED')).not.toContain('‏');
  });

  it('keeps the sign on refunds', () => {
    expect(formatMoneyAscii(-50000n, 'CAD')).toBe('-CA$500.00');
  });

  it('stays exact beyond Number.MAX_SAFE_INTEGER', () => {
    // 2^53 + 1 paise — a float would round this away.
    expect(formatMoneyAscii(2n ** 53n + 1n, 'INR')).toContain('.93');
  });
});
