/**
 * Smart Shaadi — Deterministic Forecasting Math.
 *
 * Pure functions for time-series forecasting: moving average, seasonal
 * decomposition, and projection. Referentially transparent — no I/O, no LLM.
 */

/**
 * Calculate trailing moving average.
 *
 * Returns an array of the same length as the input. Early values that have
 * fewer than `window` historical points use a centered average of available data.
 *
 * @param series Input time series (numbers)
 * @param window Window size (must be >= 1)
 * @returns Moving average series
 *
 * @example
 * movingAverage([1, 2, 3, 4, 5], 2)
 * // → [1, 1.5, 2.5, 3.5, 4.5] (0th uses [1]; 1st uses [1,2]; 2nd+ uses window)
 */
export function movingAverage(series: number[], window: number): number[] {
  if (series.length === 0) return [];
  if (window < 1) window = 1;

  const result: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = series.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }
  return result;
}

/**
 * Calculate seasonal indices for a given period.
 *
 * Divides series into periods and returns an index for each position within
 * the period: ratio of the position's average value to the grand mean.
 * Used to project seasonal multipliers forward.
 *
 * @param series Input time series (numbers, must have at least one full period)
 * @param period Period length (e.g., 12 for monthly data with 12-month seasonality)
 * @returns Array of indices, one per period position (length = period)
 *
 * @example
 * seasonalIndex([100, 110, 120, 100, 110, 120, 100, 110, 120], 3)
 * // Positions: [100, 110, 120], [100, 110, 120], [100, 110, 120]
 * // Grand avg = 110
 * // → [100/110, 110/110, 120/110] ≈ [0.909, 1.0, 1.091]
 */
export function seasonalIndex(series: number[], period: number): number[] {
  if (series.length === 0 || period < 1) {
    return Array(period).fill(1); // neutral (no seasonality)
  }

  const grandMean = series.reduce((a, b) => a + b, 0) / series.length;

  // Guard against zero mean (avoid divide-by-zero)
  if (grandMean === 0) {
    return Array(period).fill(1);
  }

  const positionAverages: number[] = Array(period).fill(0);
  const positionCounts: number[] = Array(period).fill(0);

  for (let i = 0; i < series.length; i++) {
    const pos = i % period;
    positionAverages[pos]! += series[i]!;
    positionCounts[pos]!++;
  }

  const indices: number[] = [];
  for (let i = 0; i < period; i++) {
    const count = positionCounts[i] ?? 1;
    const avg = count > 0 ? positionAverages[i]! / count : grandMean;
    indices.push(avg / grandMean);
  }

  return indices;
}

/**
 * Project a time series forward using moving average level + seasonal indices.
 *
 * Combines:
 *   1. MA level (detrended value, guards against flat forecasts)
 *   2. Seasonal multiplier (optional; defaults to no seasonality if period not given)
 *   3. Final value defaults to grand mean if level would be 0 or series is empty
 *
 * @param series Input time series (numbers)
 * @param horizon Number of future points to forecast (must be > 0)
 * @param period Optional period for seasonal adjustment (e.g., 12 for monthly seasonality)
 * @returns Array of forecasted values (length = horizon)
 *
 * @example
 * forecast([10, 20, 30, 40], 2)
 * // MA(2) = [10, 15, 25, 35]; final = 35
 * // → [35, 35] (flat extension)
 *
 * forecast([100, 110, 120, 100, 110, 120, 100, 110], 3, 3)
 * // Seasonal: [100/110, 110/110, 120/110] ≈ [0.909, 1.0, 1.091]
 * // MA(3) level ≈ 110
 * // → [110*0.909, 110*1.0, 110*1.091] ≈ [100, 110, 120]
 */
export function forecast(
  series: number[],
  horizon: number,
  period?: number,
): number[] {
  if (horizon <= 0) return [];
  if (series.length === 0) return Array(horizon).fill(0);

  // Use a window of min(3, series.length) for level estimation
  const window = Math.min(3, series.length);
  const levels = movingAverage(series, window);
  const level = levels[levels.length - 1] ?? 0;

  // When the trailing MA is non-positive, fall back to the grand mean. For a
  // genuinely zero history (e.g. a vendor with no bookings yet) the grand mean
  // is 0 and the correct projection is 0 — never an arbitrary 1.
  const safeLevel = level > 0 ? level : series.reduce((a, b) => a + b, 0) / series.length;
  const finalLevel = safeLevel;

  // If no period, return flat forecast
  if (!period || period < 1) {
    return Array(horizon).fill(finalLevel);
  }

  // Get seasonal indices
  const indices = seasonalIndex(series, period);
  const result: number[] = [];

  // Project each future point
  for (let i = 0; i < horizon; i++) {
    const pos = (series.length + i) % period;
    const index = indices[pos] ?? 1;
    result.push(finalLevel * index);
  }

  return result;
}
