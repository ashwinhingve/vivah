import { describe, it, expect } from 'vitest';
import { sliceFeedPage } from '../pagination.js';

describe('sliceFeedPage', () => {
  const full = Array.from({ length: 25 }, (_, i) => i); // [0..24]

  it('returns the first page and the full total', () => {
    const { slice, total } = sliceFeedPage(full, 1, 10);
    expect(slice).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(total).toBe(25);
  });

  it('returns the correct window for page 2', () => {
    const { slice, total } = sliceFeedPage(full, 2, 10);
    expect(slice).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(total).toBe(25);
  });

  it('returns the short final page', () => {
    const { slice } = sliceFeedPage(full, 3, 10);
    expect(slice).toEqual([20, 21, 22, 23, 24]);
  });

  it('returns an empty slice past the end but keeps the real total', () => {
    const { slice, total } = sliceFeedPage(full, 99, 10);
    expect(slice).toEqual([]);
    expect(total).toBe(25);
  });
});
