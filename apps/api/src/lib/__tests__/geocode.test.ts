import { describe, it, expect, beforeEach } from 'vitest';
import { geocode, haversineKm, _resetGeocodeCache } from '../geocode.js';

describe('geocode (mock mode)', () => {
  beforeEach(() => {
    process.env['USE_MOCK_SERVICES'] = 'true';
    _resetGeocodeCache();
  });

  it('returns deterministic coords for known city', async () => {
    const a = await geocode('Pune', 'Maharashtra');
    const b = await geocode('Pune', 'Maharashtra');
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a!.lat).toBeGreaterThan(18);
    expect(a!.lat).toBeLessThan(19);
  });

  it('handles case + spaces', async () => {
    const a = await geocode('  PUNE ', 'maharashtra');
    expect(a?.lat).toBeCloseTo(18.5204, 2);
  });

  it('falls back to state centroid for unknown city in known state', async () => {
    const r = await geocode('NonExistentCityX', 'Maharashtra');
    expect(r).not.toBeNull();
  });

  it('returns null for unknown state', async () => {
    const r = await geocode('FooBar', 'Atlantis');
    expect(r).toBeNull();
  });
});

describe('haversineKm', () => {
  it('returns 0 for same coords', () => {
    expect(haversineKm({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 })).toBe(0);
  });

  it('Pune→Mumbai is roughly 120km', () => {
    const km = haversineKm({ lat: 18.5204, lng: 73.8567 }, { lat: 19.0760, lng: 72.8777 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(160);
  });

  it('Pune→Delhi is roughly 1170km', () => {
    const km = haversineKm({ lat: 18.5204, lng: 73.8567 }, { lat: 28.7041, lng: 77.1025 });
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1250);
  });
});
