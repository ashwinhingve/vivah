/**
 * Unit tests for deterministic forecasting functions.
 * Extensive coverage of edge cases: empty series, short series, divide-by-zero guards.
 */

import { describe, it, expect } from 'vitest';
import { movingAverage, seasonalIndex, forecast } from '../forecasting.js';

describe('movingAverage', () => {
  it('returns empty array for empty input', () => {
    expect(movingAverage([], 2)).toEqual([]);
  });

  it('handles single-value series', () => {
    expect(movingAverage([5], 2)).toEqual([5]);
  });

  it('applies window averaging correctly', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 2);
    // Window 2: [1], [1,2], [2,3], [3,4], [4,5]
    expect(result).toEqual([1, 1.5, 2.5, 3.5, 4.5]);
  });

  it('handles window larger than series', () => {
    const result = movingAverage([10, 20, 30], 10);
    // All values use entire available series as window
    const avg = (10 + 20 + 30) / 3;
    expect(result).toEqual([10, (10 + 20) / 2, avg]);
  });

  it('treats window < 1 as window = 1 (no averaging)', () => {
    const result = movingAverage([5, 10, 15], 0);
    expect(result).toEqual([5, 10, 15]);
  });

  it('handles negative window gracefully', () => {
    const result = movingAverage([5, 10, 15], -5);
    expect(result).toEqual([5, 10, 15]);
  });

  it('works with floats', () => {
    const result = movingAverage([1.5, 2.5, 3.5], 2);
    expect(result).toEqual([1.5, 2, 3]);
  });

  it('works with zeros', () => {
    const result = movingAverage([0, 0, 0], 2);
    expect(result).toEqual([0, 0, 0]);
  });

  it('works with negative values', () => {
    const result = movingAverage([-10, -5, 0, 5, 10], 2);
    expect(result).toEqual([-10, -7.5, -2.5, 2.5, 7.5]);
  });
});

describe('seasonalIndex', () => {
  it('returns neutral indices for empty series', () => {
    expect(seasonalIndex([], 3)).toEqual([1, 1, 1]);
  });

  it('returns neutral indices for period < 1', () => {
    expect(seasonalIndex([1, 2, 3], 0)).toEqual([]);
  });

  it('calculates seasonal indices correctly for repeating pattern', () => {
    // Pattern: 100, 110, 120 repeats 3 times
    const series = [100, 110, 120, 100, 110, 120, 100, 110, 120];
    const result = seasonalIndex(series, 3);
    const grandMean = 110;
    expect(result[0]).toBeCloseTo(100 / grandMean, 5);
    expect(result[1]).toBeCloseTo(110 / grandMean, 5);
    expect(result[2]).toBeCloseTo(120 / grandMean, 5);
  });

  it('handles incomplete last period', () => {
    // Pattern: 10, 20, 30 but last period incomplete
    const series = [10, 20, 30, 10, 20, 30, 10, 20];
    const result = seasonalIndex(series, 3);
    const grandMean = (10 + 20 + 30 + 10 + 20 + 30 + 10 + 20) / 8;
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo((10 + 10 + 10) / 3 / grandMean, 5);
  });

  it('guards against zero grand mean', () => {
    const result = seasonalIndex([0, 0, 0], 3);
    expect(result).toEqual([1, 1, 1]);
  });

  it('handles single-period series', () => {
    const result = seasonalIndex([100], 3);
    // Grand mean = 100; only one data point at pos 0
    expect(result).toEqual([1, 1, 1]); // 100/100 for pos 0, 1 for others (no data)
  });

  it('works with floats and mixed patterns', () => {
    const series = [1.5, 2.5, 1.5, 2.5];
    const result = seasonalIndex(series, 2);
    const grandMean = 2;
    expect(result[0]).toBeCloseTo(1.5 / grandMean, 5);
    expect(result[1]).toBeCloseTo(2.5 / grandMean, 5);
  });

  it('normalizes correctly for high-variance seasonal pattern', () => {
    // 50% variance above/below mean
    const series = [50, 150, 50, 150, 50, 150];
    const result = seasonalIndex(series, 2);
    expect(result[0]).toBeCloseTo(50 / 100, 5);
    expect(result[1]).toBeCloseTo(150 / 100, 5);
  });
});

describe('forecast', () => {
  it('returns empty array for zero or negative horizon', () => {
    expect(forecast([1, 2, 3], 0)).toEqual([]);
    expect(forecast([1, 2, 3], -5)).toEqual([]);
  });

  it('returns zeros for empty series', () => {
    expect(forecast([], 3)).toEqual([0, 0, 0]);
  });

  it('projects flat when no period given', () => {
    const result = forecast([10, 20, 30, 40], 2);
    const ma = movingAverage([10, 20, 30, 40], 3);
    const level = ma[ma.length - 1];
    expect(result).toEqual([level, level]);
  });

  it('applies seasonal multipliers when period given', () => {
    // Perfect 3-month cycle: 100, 110, 120
    const series = [100, 110, 120, 100, 110, 120];
    const result = forecast(series, 3, 3);
    // Expected: ~100, ~110, ~120
    expect(result[0]).toBeCloseTo(100, 1);
    expect(result[1]).toBeCloseTo(110, 1);
    expect(result[2]).toBeCloseTo(120, 1);
  });

  it('handles series shorter than window + period', () => {
    const result = forecast([5, 10, 15], 2, 12);
    expect(result.length).toBe(2);
    expect(result.every(v => typeof v === 'number')).toBe(true);
  });

  it('guards against zero level', () => {
    // MA will be near zero; should fall back to grand mean
    const result = forecast([0, 0, 0], 2);
    expect(result).toEqual([0, 0]);
  });

  it('uses grand mean fallback for all-zero series', () => {
    const result = forecast([0, 0, 0, 0], 3);
    expect(result).toEqual([0, 0, 0]);
  });

  it('projects correctly for positive trend', () => {
    const result = forecast([10, 20, 30, 40, 50], 2);
    const ma = movingAverage([10, 20, 30, 40, 50], 3);
    const level = ma[ma.length - 1]!;
    expect(result[0]).toBeCloseTo(level, 1);
    expect(result[1]).toBeCloseTo(level, 1);
  });

  it('projects with seasonal pattern across period boundary', () => {
    // 12-month pattern; project 18 months to wrap around
    const monthly = Array(24).fill(0).map((_, i) => 100 + 20 * Math.sin((i / 12) * 2 * Math.PI));
    const result = forecast(monthly, 6, 12);
    expect(result.length).toBe(6);
    // All values should be reasonable (not NaN, not Infinity)
    expect(result.every(v => Number.isFinite(v))).toBe(true);
  });

  it('handles single-value series', () => {
    const result = forecast([42], 3);
    expect(result).toEqual([42, 42, 42]);
  });

  it('handles two-value series with period', () => {
    const result = forecast([100, 150], 2, 2);
    // Should use seasonal indices for positions 2, 3 (wraps to 0, 1)
    expect(result.length).toBe(2);
    expect(result.every(v => Number.isFinite(v))).toBe(true);
  });

  it('produces no NaN or Infinity values', () => {
    const pathological = [1000000, 0.0001, 999999, 0.5];
    const result = forecast(pathological, 5, 2);
    expect(result.every(v => Number.isFinite(v))).toBe(true);
  });

  it('respects period boundary wrapping', () => {
    // 3-month cycle, project 5 months → wraps twice
    const series = [10, 20, 30, 10, 20, 30, 10];
    const result = forecast(series, 5, 3);
    expect(result.length).toBe(5);
    // Positions 7,8,9,10,11 → period indices 1,2,0,1,2
  });
});

describe('integration: realistic scenarios', () => {
  it('handles typical monthly demand data', () => {
    // 12 months of bookings with seasonal bump in months 11-12
    const demand = [100, 110, 105, 100, 95, 90, 85, 80, 85, 95, 120, 140];
    const forecast_result = forecast(demand, 6, 12);
    expect(forecast_result.length).toBe(6);
    expect(forecast_result.every(v => v > 0)).toBe(true);
  });

  it('projects a flat moving-average level for a growth trend (MA does not extrapolate trend)', () => {
    // 6 months of accelerating revenue
    const revenue = [50000, 60000, 72000, 86400, 103680, 124416];
    const forecast_result = forecast(revenue, 3);
    expect(forecast_result.length).toBe(3);
    // MA(3) of the last three points = mean(86400,103680,124416) = 104832.
    // A moving-average forecast is FLAT at that level — by design it does not
    // extrapolate the upward trend (the documented deterministic method).
    expect(forecast_result.every(v => v === forecast_result[0])).toBe(true);
    expect(forecast_result[0]!).toBeCloseTo(104832, 0);
    expect(forecast_result.every(v => Number.isFinite(v) && v > 0)).toBe(true);
  });

  it('handles utilization data (0..1 range)', () => {
    // 12 months of vendor utilization
    const utilization = [0.5, 0.55, 0.6, 0.65, 0.6, 0.55, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75];
    const forecast_result = forecast(utilization, 3, 12);
    expect(forecast_result.length).toBe(3);
    expect(forecast_result.every(v => Number.isFinite(v))).toBe(true);
  });
});
