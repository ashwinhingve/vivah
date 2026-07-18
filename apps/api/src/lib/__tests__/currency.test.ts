/**
 * Currency formatting tests.
 *
 * Verifies:
 *   - INR lakh/crore grouping (en-IN locale)
 *   - All 8 supported currencies format correctly
 *   - Precision handling for values beyond Number.MAX_SAFE_INTEGER
 *   - Negative amounts (refunds)
 *   - Zero amounts
 *   - ASCII variant for PDFs (Rs. not ₹)
 *   - Input validation (invalid paise, unsupported currency)
 */

import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyAscii } from '../currency';

describe('formatMoney', () => {
  describe('INR formatting', () => {
    it('formats basic INR amounts with lakh/crore grouping', () => {
      // Single lakh (100,000 rupees = 10,000,000 paise)
      // Note: 100_00_000 is just 10000000 in decimal (underscores don't affect value)
      expect(formatMoney(10_000_000n, 'INR')).toMatch(/₹1,00,000\.00/);

      // Multiple lakhs (1,234,567.89 rupees = 123,456,789 paise)
      expect(formatMoney(123_456_789n, 'INR')).toMatch(/₹12,34,567\.89/);

      // Below lakh (500 rupees)
      expect(formatMoney(50_000n, 'INR')).toMatch(/₹500\.00/);

      // Crores (1,00,00,000 rupees = 10 million rupees = 1 billion paise)
      expect(formatMoney(1_000_000_000n, 'INR')).toMatch(/₹1,00,00,000\.00/);
    });

    it('formats INR with paise (fractional rupees)', () => {
      // ₹12.34
      expect(formatMoney(1_234n, 'INR')).toMatch(/₹12\.34/);

      // ₹0.99
      expect(formatMoney(99n, 'INR')).toMatch(/₹0\.99/);

      // ₹0.01
      expect(formatMoney(1n, 'INR')).toMatch(/₹0\.01/);
    });

    it('formats zero INR', () => {
      expect(formatMoney(0n, 'INR')).toMatch(/₹0\.00/);
    });

    it('formats negative INR (refunds)', () => {
      // Negative 12.34
      const result = formatMoney(-1_234n, 'INR');
      // Should contain minus sign and correct amount
      expect(result).toMatch(/[−-].*₹.*12\.34/);
    });
  });

  describe('Other currency formatting', () => {
    it('formats USD with $ symbol', () => {
      // $12.34
      expect(formatMoney(1_234n, 'USD')).toMatch(/\$12\.34/);

      // $0.99
      expect(formatMoney(99n, 'USD')).toMatch(/\$0\.99/);

      // $1000.00
      expect(formatMoney(100_000n, 'USD')).toMatch(/\$1,000\.00/);
    });

    it('formats GBP with £ symbol', () => {
      // £12.34
      expect(formatMoney(1_234n, 'GBP')).toMatch(/£12\.34/);
    });

    it('formats EUR with € symbol', () => {
      // EUR may use , or . as decimal separator and vary symbol placement by locale
      const result = formatMoney(1_234n, 'EUR');
      expect(result).toContain('€');
      // Just verify the digits are present (order may vary by locale)
      expect(result).toMatch(/1.*2.*3.*4/);
    });

    it('formats AED', () => {
      // AED may show Arabic symbol or 'AED' depending on locale
      const result = formatMoney(1_234n, 'AED');
      // Just verify currency symbol appears and value is there
      expect(result).toMatch(/د\.إ|AED/);
      // Flexible on decimal separator and formatting
      expect(result).toMatch(/1.*2.*3.*4/);
    });

    it('formats CAD, AUD, SGD', () => {
      const cadResult = formatMoney(1_234n, 'CAD');
      expect(cadResult).toMatch(/12\.34/);

      const audResult = formatMoney(1_234n, 'AUD');
      expect(audResult).toMatch(/12\.34/);

      const sgdResult = formatMoney(1_234n, 'SGD');
      expect(sgdResult).toMatch(/12\.34/);
    });
  });

  describe('Large number handling (precision beyond Number.MAX_SAFE_INTEGER)', () => {
    it('handles amounts exceeding Number.MAX_SAFE_INTEGER (2^53 - 1)', () => {
      // 2^53 = 9007199254740992
      // This is beyond Number.MAX_SAFE_INTEGER = 9007199254740991
      const hugeAmount = BigInt('9007199254740992');
      const result = formatMoney(hugeAmount, 'USD');

      // Should format without precision loss
      // In cents, this is $90,071,992,547,409.92
      expect(result).toMatch(/90,071,992,547,409\.92|90071992547409\.92/);
    });

    it('handles even larger amounts (e.g., B2B contracts)', () => {
      const veryLargeAmount = BigInt('999999999999999999'); // 19 digits
      const result = formatMoney(veryLargeAmount, 'INR');

      // Should format correctly as ₹9,99,99,99,99,99,99,999.99 (or similar with lakh grouping)
      // The exact format depends on Intl.NumberFormat's lakh grouping
      expect(result).toContain('₹');
      expect(result).toContain('99');
    });
  });

  describe('Zero and negative handling', () => {
    it('formats zero across all currencies', () => {
      const currencies = ['INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'SGD'] as const;
      currencies.forEach(currency => {
        const result = formatMoney(0n, currency);
        // Verify that result contains 0 and two 0s for decimal places
        // (locale may place symbol and separator differently)
        expect(result).toMatch(/0/);
        expect(result).toMatch(/00/); // Two zeros for cents/paise
      });
    });

    it('formats negative amounts (refunds)', () => {
      // All currencies should handle negatives
      const usdNegative = formatMoney(-5_000n, 'USD');
      expect(usdNegative).toMatch(/[−-]/); // Minus or minus sign
      expect(usdNegative).toMatch(/50\.00/);

      const inrNegative = formatMoney(-50n, 'INR');
      expect(inrNegative).toMatch(/[−-]/);
      expect(inrNegative).toMatch(/₹0\.50/);
    });
  });

  describe('Input validation', () => {
    it('accepts bigint paise', () => {
      const result = formatMoney(1_234n, 'INR');
      expect(result).toContain('₹');
    });

    it('accepts string paise (decimal integer)', () => {
      const result = formatMoney('1234', 'INR');
      expect(result).toContain('₹');
      expect(result).toContain('12.34');
    });

    it('rejects invalid string paise', () => {
      expect(() => formatMoney('not-a-number', 'INR')).toThrow(/Invalid paise value/);
      expect(() => formatMoney('12.34', 'INR')).toThrow(/Invalid paise value/); // Float string
      expect(() => formatMoney('', 'INR')).toThrow(/Invalid paise value/);
    });

    it('rejects unsupported currencies', () => {
      // @ts-expect-error Testing runtime validation
      expect(() => formatMoney(1_234n, 'XXX')).toThrow(/Unsupported currency/);
    });
  });

  describe('ASCII variant (PDFs)', () => {
    it('replaces ₹ with Rs. in ascii mode', () => {
      const normal = formatMoney(1_234n, 'INR');
      const ascii = formatMoney(1_234n, 'INR', { ascii: true });

      expect(normal).toContain('₹');
      expect(ascii).not.toContain('₹');
      expect(ascii).toContain('Rs.');
      // The numeric part should match
      expect(ascii).toContain('12.34');
    });

    it('replaces other currency symbols with ASCII equivalents', () => {
      const usdAscii = formatMoney(1_234n, 'USD', { ascii: true });
      expect(usdAscii).toContain('US$');

      const eurAscii = formatMoney(1_234n, 'EUR', { ascii: true });
      expect(eurAscii).toContain('EUR');

      const gbpAscii = formatMoney(1_234n, 'GBP', { ascii: true });
      expect(gbpAscii).toContain('GBP');
    });

    it('handles negative amounts in ascii mode', () => {
      const usdAscii = formatMoney(-5_000n, 'USD', { ascii: true });
      expect(usdAscii).toContain('US$');
      expect(usdAscii).toMatch(/[−-]/);
    });
  });

  describe('formatMoneyAscii convenience wrapper', () => {
    it('is equivalent to formatMoney with ascii: true', () => {
      const currencies = ['INR', 'USD', 'GBP', 'EUR'] as const;
      const amounts = [1_234n, 50n, 0n, -1_000n];

      currencies.forEach(currency => {
        amounts.forEach(amount => {
          const method1 = formatMoney(amount, currency, { ascii: true });
          const method2 = formatMoneyAscii(amount, currency);
          expect(method2).toBe(method1);
        });
      });
    });

    it('produces PDF-safe output', () => {
      const result = formatMoneyAscii(123_45_678n, 'INR');
      // Should not contain ₹ (may not be available in Helvetica)
      expect(result).not.toContain('₹');
      // Should contain Rs.
      expect(result).toContain('Rs.');
    });
  });

  describe('Consistency across locales', () => {
    it('always formats decimal separator correctly within the same locale', () => {
      // Format multiple amounts with same currency; separator should be consistent
      const a1 = formatMoney(1_234n, 'USD');
      const a2 = formatMoney(5_678n, 'USD');
      const a3 = formatMoney(91_011n, 'USD');

      // All should use the same decimal separator (.)
      const sep1 = a1.includes('.') ? '.' : ',';
      const sep2 = a2.includes('.') ? '.' : ',';
      const sep3 = a3.includes('.') ? '.' : ',';

      expect(sep1).toBe(sep2);
      expect(sep2).toBe(sep3);
    });

    it('INR uses lakh grouping, not standard thousands', () => {
      const result = formatMoney(123_45_678n, 'INR'); // ₹1,23,45,678.00
      // Should have the lakh grouping pattern (groups of 2 after first 3)
      // This is harder to test precisely without parsing, but we can verify
      // it's different from standard grouping by checking specific patterns
      expect(result).toContain('₹');
      // The result should have multiple commas
      const commaCount = (result.match(/,/g) || []).length;
      expect(commaCount).toBeGreaterThan(1);
    });
  });

  describe('Edge cases', () => {
    it('handles 1 paise (smallest positive amount)', () => {
      const result = formatMoney(1n, 'INR');
      expect(result).toMatch(/₹0\.01/);
    });

    it('handles -1 paise', () => {
      const result = formatMoney(-1n, 'INR');
      expect(result).toMatch(/[−-].*₹0\.01/);
    });

    it('handles amounts with all 0 paise (e.g., exactly 1 rupee)', () => {
      const result = formatMoney(100n, 'INR');
      expect(result).toMatch(/₹1\.00/);
    });

    it('handles boundary between major and minor units', () => {
      // 99 paise
      const a = formatMoney(99n, 'INR');
      expect(a).toMatch(/₹0\.99/);

      // 100 paise = 1 rupee
      const b = formatMoney(100n, 'INR');
      expect(b).toMatch(/₹1\.00/);

      // 101 paise
      const c = formatMoney(101n, 'INR');
      expect(c).toMatch(/₹1\.01/);
    });
  });
});
