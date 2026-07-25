/**
 * Unit tests for match utilities — pure functions.
 * No mocking required; test score formatting and tier logic.
 */

const {
  formatCompatibilityScore,
  getTierColor,
  getTierLabel,
  formatScoreComponent,
} = require('../utils');

describe('Match Utils', () => {
  describe('formatCompatibilityScore', () => {
    it('formats 85.3 as 85.3%', () => {
      expect(formatCompatibilityScore(85.3)).toBe('85.3%');
    });

    it('formats 90 as 90%', () => {
      expect(formatCompatibilityScore(90)).toBe('90%');
    });

    it('formats 75.567 as 75.6%', () => {
      expect(formatCompatibilityScore(75.567)).toBe('75.6%');
    });

    it('handles 0%', () => {
      expect(formatCompatibilityScore(0)).toBe('0%');
    });

    it('handles 100%', () => {
      expect(formatCompatibilityScore(100)).toBe('100%');
    });
  });

  describe('getTierColor', () => {
    // Returns a theme-palette key (resolved by the caller against light/dark),
    // not a fixed hex — that's what keeps the tier badge correct in dark mode.
    it('returns "success" for excellent tier', () => {
      expect(getTierColor('excellent')).toBe('success');
    });

    it('returns "gold" for good tier', () => {
      expect(getTierColor('good')).toBe('gold');
    });

    it('returns "warning" for average tier', () => {
      expect(getTierColor('average')).toBe('warning');
    });

    it('returns "destructive" for low tier', () => {
      expect(getTierColor('low')).toBe('destructive');
    });
  });

  describe('getTierLabel', () => {
    it('returns "Excellent Match" for excellent tier', () => {
      expect(getTierLabel('excellent')).toBe('Excellent Match');
    });

    it('returns "Good Match" for good tier', () => {
      expect(getTierLabel('good')).toBe('Good Match');
    });

    it('returns "Average Match" for average tier', () => {
      expect(getTierLabel('average')).toBe('Average Match');
    });

    it('returns "Low Compatibility" for low tier', () => {
      expect(getTierLabel('low')).toBe('Low Compatibility');
    });
  });

  describe('formatScoreComponent', () => {
    it('formats 18/20 as "18/20 (90%)"', () => {
      expect(formatScoreComponent(18, 20)).toBe('18/20 (90%)');
    });

    it('formats 12/15 as "12/15 (80%)"', () => {
      expect(formatScoreComponent(12, 15)).toBe('12/15 (80%)');
    });

    it('formats 0/100 as "0/100 (0%)"', () => {
      expect(formatScoreComponent(0, 100)).toBe('0/100 (0%)');
    });

    it('formats 100/100 as "100/100 (100%)"', () => {
      expect(formatScoreComponent(100, 100)).toBe('100/100 (100%)');
    });
  });
});
