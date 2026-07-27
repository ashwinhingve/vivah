/**
 * A2-06 — shared GST helper. Focused on the rounding invariant (cgst + sgst ===
 * total) for odd-rupee amounts, and the intra- vs inter-state split. This is the
 * coverage the persisted-invoice GST previously lacked.
 */
import { describe, it, expect } from 'vitest';
import { computeGst } from '../gst.js';

describe('computeGst (A2-06)', () => {
  it('splits intra-state into CGST+SGST that sum exactly to total (odd rupees)', () => {
    for (const amount of [999, 1234.56, 100.01, 7777.77, 1]) {
      const g = computeGst(amount, 'MH', 'MH');
      expect(g.igst).toBe(0);
      expect(g.cgst + g.sgst).toBeCloseTo(g.total, 10);
      // 18% default
      expect(g.total).toBeCloseTo(Math.round(amount * 18) / 100, 10);
    }
  });

  it('treats a missing customer state as intra-state', () => {
    const g = computeGst(1000, null, 'MH');
    expect(g).toEqual({ cgst: 90, sgst: 90, igst: 0, total: 180 });
  });

  it('uses IGST (no CGST/SGST) for inter-state', () => {
    const g = computeGst(1000, 'KA', 'MH');
    expect(g).toEqual({ cgst: 0, sgst: 0, igst: 180, total: 180 });
  });

  it('is case-insensitive on state comparison', () => {
    expect(computeGst(1000, 'mh', 'MH').igst).toBe(0);
    expect(computeGst(1000, 'Mh', 'mh').cgst).toBe(90);
  });

  it('honours a non-default tax rate', () => {
    const g = computeGst(1000, 'KA', 'MH', 5);
    expect(g).toEqual({ cgst: 0, sgst: 0, igst: 50, total: 50 });
  });
});
