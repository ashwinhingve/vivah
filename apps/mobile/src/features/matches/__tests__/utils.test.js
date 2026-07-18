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
    it('returns green (#059669) for excellent tier', () => {
      expect(getTierColor('excellent')).toBe('#059669');
    });

    it('returns gold (#C5A47E) for good tier', () => {
      expect(getTierColor('good')).toBe('#C5A47E');
    });

    it('returns warning amber (#D97706) for average tier', () => {
      expect(getTierColor('average')).toBe('#D97706');
    });

    it('returns destructive red (#DC2626) for low tier', () => {
      expect(getTierColor('low')).toBe('#DC2626');
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
