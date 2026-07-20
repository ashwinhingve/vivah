import { describe, it, expect } from 'vitest';
import { maskEmail, maskPhone } from '../mask.js';

describe('maskEmail', () => {
  it('keeps the domain and the first two characters of the local part', () => {
    expect(maskEmail('ashwin.hingave123@gmail.com')).toBe('as***@gmail.com');
  });

  it('returns null for absent values rather than a masked-looking string', () => {
    // A null must stay distinguishable from "a value exists but is hidden".
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail('')).toBeNull();
  });

  it('does not leak a short local part in full', () => {
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('masks entirely when the value is not email-shaped', () => {
    // Better to over-mask junk than to slice it and emit a fragment.
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('@leading.com')).toBe('***');
  });

  it('splits on the LAST @, so a quoted local part cannot smuggle the domain', () => {
    expect(maskEmail('weird@thing@real.com')).toBe('we***@real.com');
  });
});

describe('maskPhone', () => {
  it('keeps the country code and last four digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91*****3210');
  });

  it('handles a bare ten-digit Indian number with no country code', () => {
    expect(maskPhone('9876543210')).toBe('*****3210');
  });

  it('returns null for absent values', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskPhone('')).toBeNull();
  });

  it('never echoes a number too short to mask meaningfully', () => {
    // Four digits or fewer IS the part we would otherwise reveal.
    expect(maskPhone('1234')).toBe('***');
    expect(maskPhone('12')).toBe('***');
  });

  it('strips formatting before counting digits', () => {
    expect(maskPhone('+91 98765-43210')).toBe('+91*****3210');
  });

  it('handles a longer country code without eating the subscriber number', () => {
    // NRI accounts matter here — a UK number must not mask down to nonsense.
    expect(maskPhone('+447911123456')).toBe('+44*****3456');
  });
});
