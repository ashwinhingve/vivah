/**
 * Smart Shaadi — Geocode helper
 * Resolves city+state → { lat, lng }. Mock mode uses a seed table of major IN
 * cities + state centroids; live mode queries Nominatim (OSM).
 */

import { env } from './env.js';

export interface Coords { lat: number; lng: number }

const CITY_TABLE: Record<string, Coords> = {
  mumbai:    { lat: 19.0760, lng: 72.8777 },
  delhi:     { lat: 28.7041, lng: 77.1025 },
  newdelhi:  { lat: 28.6139, lng: 77.2090 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  pune:      { lat: 18.5204, lng: 73.8567 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai:   { lat: 13.0827, lng: 80.2707 },
  kolkata:   { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur:    { lat: 26.9124, lng: 75.7873 },
  lucknow:   { lat: 26.8467, lng: 80.9462 },
  surat:     { lat: 21.1702, lng: 72.8311 },
  nagpur:    { lat: 21.1458, lng: 79.0882 },
  indore:    { lat: 22.7196, lng: 75.8577 },
  bhopal:    { lat: 23.2599, lng: 77.4126 },
  patna:     { lat: 25.5941, lng: 85.1376 },
  chandigarh:{ lat: 30.7333, lng: 76.7794 },
  gurgaon:   { lat: 28.4595, lng: 77.0266 },
  gurugram:  { lat: 28.4595, lng: 77.0266 },
  noida:     { lat: 28.5355, lng: 77.3910 },
};

const STATE_CENTROIDS: Record<string, Coords> = {
  maharashtra:    { lat: 19.7515, lng: 75.7139 },
  karnataka:      { lat: 15.3173, lng: 75.7139 },
  delhi:          { lat: 28.7041, lng: 77.1025 },
  telangana:      { lat: 18.1124, lng: 79.0193 },
  tamilnadu:      { lat: 11.1271, lng: 78.6569 },
  westbengal:     { lat: 22.9868, lng: 87.8550 },
  gujarat:        { lat: 22.2587, lng: 71.1924 },
  rajasthan:      { lat: 27.0238, lng: 74.2179 },
  uttarpradesh:   { lat: 26.8467, lng: 80.9462 },
  punjab:         { lat: 31.1471, lng: 75.3412 },
  haryana:        { lat: 29.0588, lng: 76.0856 },
  kerala:         { lat: 10.8505, lng: 76.2711 },
  bihar:          { lat: 25.0961, lng: 85.3131 },
  madhyapradesh:  { lat: 22.9734, lng: 78.6569 },
  andhrapradesh:  { lat: 15.9129, lng: 79.7400 },
  odisha:         { lat: 20.9517, lng: 85.0985 },
  jharkhand:      { lat: 23.6102, lng: 85.2799 },
  chhattisgarh:   { lat: 21.2787, lng: 81.8661 },
  uttarakhand:    { lat: 30.0668, lng: 79.0193 },
  himachalpradesh:{ lat: 31.1048, lng: 77.1734 },
  assam:          { lat: 26.2006, lng: 92.9376 },
  goa:            { lat: 15.2993, lng: 74.1240 },
  jammuandkashmir:{ lat: 33.7782, lng: 76.5762 },
};

const NORM = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');
const cache = new Map<string, Coords | null>();
const MAX_CACHE = 1000;

export function _resetGeocodeCache(): void { cache.clear(); }

export async function geocode(
  city: string,
  state: string,
  _country: string = 'India',
): Promise<Coords | null> {
  const key = `${NORM(city)}|${NORM(state)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: Coords | null = null;
  const cityKey  = NORM(city);
  const stateKey = NORM(state);

  if (env.USE_MOCK_SERVICES) {
    result = CITY_TABLE[cityKey] ?? STATE_CENTROIDS[stateKey] ?? null;
  } else {
    try {
      const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=India&format=json&limit=1`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'smartshaadi/1.0' } });
      if (resp.ok) {
        const data = (await resp.json()) as Array<{ lat: string; lon: string }>;
        if (data[0]) result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {
      result = null;
    }
    if (!result) result = STATE_CENTROIDS[stateKey] ?? null;
  }

  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, result);
  return result;
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
