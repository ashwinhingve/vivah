/**
 * Smart Shaadi — horoscope value normalisation
 *
 * ONE source of truth for turning stored horoscope values into the spellings
 * the Python Guna Milan calculator keys on.
 *
 * WHY THIS EXISTS AS A SHARED MODULE
 * ----------------------------------
 * Two paths compute Guna Milan: the background job (gunaRecalcJob.ts) and the
 * user-facing endpoint (routes/ai.ts). They must agree, and they did not.
 *
 * `packages/schemas/src/profile.ts` validates horoscope writes against
 * UPPERCASE enum values ('MESH', 'TULA'). The Python calculator keys on
 * Sanskrit spellings ('Mesha', 'Tula'). The job translated between them; the
 * endpoint did not, and passed the raw stored value straight through.
 *
 * That failure is SILENT. `guna_milan.py` looks factors up with `dict.get()`
 * and returns 0 for anything it does not recognise — it never raises. So an
 * unmapped value does not error, it produces a confidently wrong low score,
 * with nothing in the logs. On a matrimony product that is a compatibility
 * verdict shown to a family, so it matters more than the usual "wrong output"
 * bug.
 *
 * Seeded local data stores Sanskrit directly, contradicting the schema, which
 * is why the endpoint looked correct in local testing. Both forms are
 * therefore accepted below — real data is UPPERCASE, seed data is Sanskrit,
 * and neither should quietly score zero.
 */

/** Sanskrit rashi spellings the Python calculator recognises. */
const RASHI_CANONICAL = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
] as const;

/** Sanskrit nakshatra spellings the Python calculator recognises. */
const NAKSHATRA_CANONICAL = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni',
  'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
  'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada',
  'Revati',
] as const;

/**
 * DB enum (packages/schemas/src/profile.ts RASHI_VALUES) → Sanskrit.
 * The enum is NOT a simple uppercase of the Sanskrit — MITHUN/Mithuna,
 * KARK/Karka, SINGH/Simha, VRISHCHIK/Vrishchika, MAKAR/Makara, KUMBH/Kumbha,
 * MEEN/Meena all differ by more than case, so this cannot be done with
 * toLowerCase() and a capital letter.
 */
const RASHI_FROM_ENUM: Record<string, string> = {
  MESH: 'Mesha', VRISHABHA: 'Vrishabha', MITHUN: 'Mithuna', KARK: 'Karka',
  SINGH: 'Simha', KANYA: 'Kanya', TULA: 'Tula', VRISHCHIK: 'Vrishchika',
  DHANU: 'Dhanu', MAKAR: 'Makara', KUMBH: 'Kumbha', MEEN: 'Meena',
};

const NAKSHATRA_FROM_ENUM: Record<string, string> = {
  ASHWINI: 'Ashwini', BHARANI: 'Bharani', KRITTIKA: 'Krittika', ROHINI: 'Rohini',
  MRIGASHIRA: 'Mrigashira', ARDRA: 'Ardra', PUNARVASU: 'Punarvasu', PUSHYA: 'Pushya',
  ASHLESHA: 'Ashlesha', MAGHA: 'Magha', PURVA_PHALGUNI: 'Purva Phalguni',
  UTTARA_PHALGUNI: 'Uttara Phalguni', HASTA: 'Hasta', CHITRA: 'Chitra',
  SWATI: 'Swati', VISHAKHA: 'Vishakha', ANURADHA: 'Anuradha', JYESHTHA: 'Jyeshtha',
  MULA: 'Mula', PURVA_ASHADHA: 'Purva Ashadha', UTTARA_ASHADHA: 'Uttara Ashadha',
  SHRAVANA: 'Shravana', DHANISHTA: 'Dhanishtha', SHATABHISHA: 'Shatabhisha',
  PURVA_BHADRAPADA: 'Purva Bhadrapada', UTTARA_BHADRAPADA: 'Uttara Bhadrapada',
  REVATI: 'Revati',
};

const RASHI_SET     = new Set<string>(RASHI_CANONICAL);
const NAKSHATRA_SET = new Set<string>(NAKSHATRA_CANONICAL);

/**
 * Returns the Sanskrit spelling, or **null** when the value is unrecognised.
 *
 * null is deliberate and must not be softened to a default. A wrong-but-valid
 * rashi produces a plausible score that is not this person's; null lets the
 * caller refuse to show a result at all, which is the honest outcome. Stored
 * junk like 'Various' lands here.
 */
export function normalizeRashi(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (RASHI_SET.has(v)) return v;                       // already Sanskrit
  return RASHI_FROM_ENUM[v.toUpperCase()] ?? null;      // DB enum form
}

/** As `normalizeRashi`, for nakshatras. */
export function normalizeNakshatra(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (NAKSHATRA_SET.has(v)) return v;
  return NAKSHATRA_FROM_ENUM[v.toUpperCase().replace(/[\s-]+/g, '_')] ?? null;
}

export type ManglikStatus = 'YES' | 'NO' | 'PARTIAL';

/**
 * Older documents store `manglik` as a boolean, newer ones as
 * 'YES' | 'NO' | 'PARTIAL'. Anything unrecognised is treated as 'NO', which
 * matches the existing behaviour in gunaRecalcJob: absence of a recorded
 * dosha is not evidence of one.
 */
export function normalizeManglik(value: unknown): ManglikStatus {
  if (value === true || value === 'YES') return 'YES';
  if (value === 'PARTIAL') return 'PARTIAL';
  return 'NO';
}
