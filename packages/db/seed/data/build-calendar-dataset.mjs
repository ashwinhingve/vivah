// @ts-nocheck
/**
 * Provenance / one-shot generator for `calendar-2026-2027.json`.
 *
 * The emitted JSON is the SINGLE SOURCE OF TRUTH consumed at runtime by both the
 * Python muhurat engine (apps/ai-service/src/services/calendar_service.py) and the
 * TS seed (packages/db/seed/calendar.ts). This script exists only to document HOW
 * the dataset was derived and to make regeneration reproducible — it is not run in
 * any build or seed path.
 *
 * Muhurat dates: Drik Panchang "Shubh Vivah" (Hindu marriage) muhurat lists for
 *   2026 and 2027 (shubh-marriage-dates-with-muhurat.html?year=YYYY). Transcribed
 *   as (date, nakshatra-string, primary-tithi). The auspicious_band is DERIVED
 *   deterministically from the highest-ranked vivah nakshatra present that day.
 * Chaturmas: Devshayani Ekadashi (Ashadha Shukla) -> Devuthani/Prabodhini Ekadashi
 *   (Kartika Shukla). Weddings are blocked in [devshayani, devuthani). 2026 anchors
 *   25-Jul / 21-Nov verified on Drik Panchang; 2027 Devuthani 10-Nov verified,
 *   Devshayani 15-Jul derived (Ashadha Shukla Ekadashi).
 * Festivals/Govt: Drik Panchang Indian calendar 2026/2027. GOVT = the three
 *   nationwide secular gazetted holidays (Republic Day, Independence Day, Gandhi
 *   Jayanti); FESTIVAL = major national religious/cultural festivals.
 *
 * Run:  node packages/db/seed/data/build-calendar-dataset.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SOURCE = 'smartshaadi-panchang-v1';

// ── Band derivation: highest-ranked vivah nakshatra active that day ───────────
const PEAK_NAK = new Set([
  'Rohini', 'Mrigashira', 'Uttara Phalguni', 'Uttara Ashadha', 'Uttara Bhadrapada', 'Revati',
]);
const HIGH_NAK = new Set(['Magha', 'Hasta', 'Swati', 'Anuradha', 'Mula']);

/** @param {string} nakStr e.g. "Rohini/Krittika" or "Jyeshtha, Anuradha" */
function bandFor(nakStr) {
  const tokens = nakStr.split(/[/,]/).map((t) => t.trim());
  if (tokens.some((t) => PEAK_NAK.has(t))) return 'PEAK';
  if (tokens.some((t) => HIGH_NAK.has(t))) return 'HIGH';
  return 'MEDIUM';
}

// ── Muhurat source rows: [ISO date, nakshatra string, primary tithi] ──────────
const MUHURATS_2026 = [
  ['2026-02-04', 'Uttara Phalguni', 'Chaturthi'], ['2026-02-05', 'Uttara Phalguni', 'Chaturthi'],
  ['2026-02-06', 'Hasta', 'Panchami'], ['2026-02-08', 'Swati', 'Saptami'],
  ['2026-02-10', 'Anuradha', 'Navami'], ['2026-02-12', 'Mula', 'Ekadashi'],
  ['2026-02-14', 'Uttara Ashadha', 'Trayodashi'], ['2026-02-19', 'Uttara Bhadrapada', 'Tritiya'],
  ['2026-02-20', 'Uttara Bhadrapada', 'Tritiya'], ['2026-02-21', 'Revati', 'Panchami'],
  ['2026-02-24', 'Rohini', 'Navami'], ['2026-02-25', 'Mrigashira', 'Navami'],
  ['2026-02-26', 'Mrigashira', 'Dashami'], ['2026-03-02', 'Magha', 'Chaturdashi'],
  ['2026-03-03', 'Purva Phalguni, Magha', 'Purnima'], ['2026-03-04', 'Uttara Phalguni', 'Pratipada'],
  ['2026-03-07', 'Swati', 'Chaturthi'], ['2026-03-09', 'Anuradha', 'Shashthi'],
  ['2026-03-11', 'Mula', 'Navami'], ['2026-03-12', 'Mula', 'Navami'],
  ['2026-04-15', 'Uttara Bhadrapada', 'Trayodashi'], ['2026-04-20', 'Rohini', 'Tritiya'],
  ['2026-04-21', 'Mrigashira', 'Panchami'], ['2026-04-25', 'Magha', 'Dashami'],
  ['2026-04-26', 'Magha', 'Dashami'], ['2026-04-27', 'Uttara Phalguni, Purva Phalguni', 'Dwadashi'],
  ['2026-04-28', 'Uttara Phalguni, Hasta', 'Trayodashi'], ['2026-04-29', 'Hasta', 'Trayodashi'],
  ['2026-05-01', 'Swati', 'Purnima'], ['2026-05-03', 'Anuradha', 'Dwitiya'],
  ['2026-05-05', 'Mula', 'Chaturthi'], ['2026-05-06', 'Mula', 'Chaturthi'],
  ['2026-05-07', 'Uttara Ashadha', 'Shashthi'], ['2026-05-08', 'Uttara Ashadha', 'Shashthi'],
  ['2026-05-13', 'Uttara Bhadrapada, Revati', 'Dwadashi'], ['2026-05-14', 'Revati', 'Dwadashi'],
  ['2026-06-21', 'Uttara Phalguni', 'Saptami'], ['2026-06-22', 'Hasta', 'Ashtami'],
  ['2026-06-23', 'Hasta', 'Navami'], ['2026-06-24', 'Swati', 'Dashami'],
  ['2026-06-25', 'Swati', 'Ekadashi'], ['2026-06-26', 'Anuradha', 'Dwadashi'],
  ['2026-06-27', 'Anuradha', 'Trayodashi'], ['2026-06-29', 'Mula', 'Purnima'],
  ['2026-07-07', 'Uttara Bhadrapada', 'Saptami'],
  // NOTE: 2026-07-01/06/11/12 are DISPUTED (see DISPUTED_MUHURATS below) — they
  // depend on Drik's Devshayani=25-Jul reading and are not independently
  // corroborated; held out of the seeded list pending panchang-authority ruling.
  // 2026-07-07 is independently corroborated (ProKerala), so it stays.
  // ── Chaturmas 2026: 25-Jul -> 21-Nov (no muhurats) ──
  ['2026-11-21', 'Revati', 'Dwadashi'], ['2026-11-24', 'Rohini', 'Pratipada'],
  ['2026-11-25', 'Rohini, Mrigashira', 'Pratipada'], ['2026-11-26', 'Mrigashira', 'Dwitiya'],
  ['2026-12-02', 'Uttara Phalguni', 'Navami'], ['2026-12-03', 'Uttara Phalguni, Hasta', 'Dashami'],
  ['2026-12-04', 'Hasta', 'Ekadashi'], ['2026-12-05', 'Swati', 'Dwadashi'],
  ['2026-12-06', 'Swati', 'Trayodashi'], ['2026-12-11', 'Uttara Ashadha', 'Tritiya'],
  ['2026-12-12', 'Uttara Ashadha', 'Tritiya'],
];

const MUHURATS_2027 = [
  ['2027-01-15', 'Revati', 'Saptami'], ['2027-01-18', 'Rohini, Krittika', 'Ekadashi'],
  ['2027-01-19', 'Rohini, Mrigashira', 'Dwadashi'], ['2027-01-20', 'Mrigashira', 'Trayodashi'],
  ['2027-01-24', 'Magha', 'Tritiya'], ['2027-01-26', 'Uttara Phalguni, Hasta', 'Panchami'],
  ['2027-01-27', 'Hasta', 'Shashthi'], ['2027-01-30', 'Anuradha', 'Navami'],
  ['2027-01-31', 'Anuradha', 'Dashami'], ['2027-02-02', 'Mula', 'Dwadashi'],
  ['2027-02-03', 'Mula', 'Dwadashi'], ['2027-02-09', 'Uttara Bhadrapada', 'Chaturthi'],
  ['2027-02-10', 'Uttara Bhadrapada, Revati', 'Chaturthi'], ['2027-02-11', 'Revati', 'Panchami'],
  ['2027-02-14', 'Rohini', 'Navami'], ['2027-02-15', 'Rohini', 'Navami'],
  ['2027-02-21', 'Magha', 'Pratipada'], ['2027-02-22', 'Uttara Phalguni', 'Dwitiya'],
  ['2027-02-25', 'Swati', 'Panchami'], ['2027-02-26', 'Swati', 'Shashthi'],
  ['2027-02-27', 'Anuradha', 'Ashtami'], ['2027-02-28', 'Anuradha', 'Ashtami'],
  ['2027-03-01', 'Mula', 'Navami'], ['2027-03-02', 'Mula', 'Dashami'],
  ['2027-03-03', 'Uttara Ashadha', 'Ekadashi'], ['2027-03-04', 'Uttara Ashadha', 'Dwadashi'],
  ['2027-03-09', 'Uttara Bhadrapada', 'Pratipada'], ['2027-03-10', 'Uttara Bhadrapada, Revati', 'Dwitiya'],
  ['2027-03-14', 'Rohini', 'Saptami'], ['2027-04-18', 'Uttara Phalguni', 'Dwadashi'],
  ['2027-04-19', 'Hasta', 'Chaturdashi'], ['2027-04-21', 'Swati', 'Pratipada'],
  ['2027-04-23', 'Anuradha', 'Tritiya'], ['2027-04-24', 'Jyeshtha, Anuradha', 'Chaturthi'],
  ['2027-04-25', 'Mula', 'Panchami'], ['2027-04-26', 'Mula', 'Panchami'],
  ['2027-04-27', 'Uttara Ashadha', 'Saptami'], ['2027-04-28', 'Uttara Ashadha', 'Saptami'],
  ['2027-05-04', 'Revati', 'Trayodashi'], ['2027-05-07', 'Rohini', 'Dwitiya'],
  ['2027-05-08', 'Mrigashira', 'Tritiya'], ['2027-05-09', 'Mrigashira', 'Tritiya'],
  ['2027-05-13', 'Magha', 'Ashtami'], ['2027-05-14', 'Magha', 'Navami'],
  ['2027-05-15', 'Uttara Phalguni', 'Dashami'], ['2027-05-16', 'Hasta', 'Dwadashi'],
  ['2027-05-17', 'Hasta', 'Dwadashi'], ['2027-05-18', 'Swati', 'Chaturdashi'],
  ['2027-05-19', 'Swati', 'Chaturdashi'], ['2027-05-20', 'Anuradha', 'Pratipada'],
  ['2027-05-21', 'Anuradha', 'Pratipada'], ['2027-05-22', 'Mula', 'Tritiya'],
  ['2027-05-23', 'Mula', 'Tritiya'], ['2027-05-24', 'Uttara Ashadha', 'Panchami'],
  ['2027-05-25', 'Uttara Ashadha', 'Panchami'], ['2027-05-30', 'Uttara Bhadrapada', 'Dashami'],
  ['2027-05-31', 'Uttara Bhadrapada, Revati', 'Ekadashi'], ['2027-06-01', 'Revati', 'Ekadashi'],
  ['2027-06-05', 'Mrigashira', 'Pratipada'], ['2027-06-09', 'Magha', 'Shashthi'],
  ['2027-06-10', 'Magha', 'Shashthi'], ['2027-06-11', 'Uttara Phalguni', 'Ashtami'],
  ['2027-06-12', 'Uttara Phalguni', 'Navami'], ['2027-06-13', 'Hasta', 'Dashami'],
  ['2027-06-15', 'Swati', 'Dwadashi'], ['2027-06-16', 'Anuradha', 'Trayodashi'],
  ['2027-06-17', 'Anuradha', 'Chaturdashi'], ['2027-06-19', 'Mula', 'Pratipada'],
  ['2027-06-20', 'Uttara Ashadha', 'Dwitiya'], ['2027-06-21', 'Uttara Ashadha', 'Dwitiya'],
  ['2027-06-26', 'Uttara Bhadrapada', 'Saptami'], ['2027-06-27', 'Uttara Bhadrapada, Revati', 'Ashtami'],
  ['2027-06-28', 'Revati', 'Navami'], ['2027-07-07', 'Magha', 'Panchami'],
  ['2027-07-08', 'Uttara Phalguni', 'Shashthi'], ['2027-07-09', 'Uttara Phalguni', 'Shashthi'],
  ['2027-07-11', 'Swati', 'Navami'], ['2027-07-12', 'Swati', 'Navami'],
  // ── Chaturmas 2027: 15-Jul -> 10-Nov (no muhurats) ──
  ['2027-11-10', 'Uttara Bhadrapada', 'Dwadashi'], ['2027-11-11', 'Revati', 'Trayodashi'],
  ['2027-11-15', 'Rohini', 'Dwitiya'], ['2027-11-16', 'Mrigashira', 'Tritiya'],
  ['2027-11-20', 'Magha', 'Ashtami'], ['2027-11-21', 'Magha', 'Ashtami'],
  ['2027-11-23', 'Uttara Phalguni, Hasta', 'Ekadashi'], ['2027-11-24', 'Hasta', 'Ekadashi'],
  ['2027-11-25', 'Swati', 'Trayodashi'], ['2027-11-26', 'Swati', 'Trayodashi'],
  ['2027-11-29', 'Mula', 'Dwitiya'], ['2027-12-02', 'Uttara Ashadha', 'Panchami'],
  ['2027-12-07', 'Uttara Bhadrapada', 'Navami'], ['2027-12-08', 'Revati', 'Ekadashi'],
  ['2027-12-09', 'Revati', 'Ekadashi'], ['2027-12-12', 'Rohini', 'Chaturdashi'],
  ['2027-12-13', 'Rohini, Mrigashira', 'Purnima'], ['2027-12-14', 'Mrigashira', 'Pratipada'],
];

// ── Festivals (national religious/cultural) ───────────────────────────────────
const FESTIVALS = [
  ['2026-01-14', 'Makar Sankranti'], ['2026-02-15', 'Maha Shivratri'],
  ['2026-03-04', 'Holi'], ['2026-03-20', 'Eid ul-Fitr'], ['2026-03-27', 'Ram Navami'],
  ['2026-03-31', 'Mahavir Jayanti'], ['2026-04-03', 'Good Friday'], ['2026-05-01', 'Buddha Purnima'],
  ['2026-05-27', 'Eid ul-Adha (Bakrid)'], ['2026-08-28', 'Raksha Bandhan'],
  ['2026-09-04', 'Janmashtami'], ['2026-09-14', 'Ganesh Chaturthi'], ['2026-10-20', 'Dussehra'],
  ['2026-11-08', 'Diwali'], ['2026-11-24', 'Guru Nanak Jayanti'], ['2026-12-25', 'Christmas'],
  ['2027-01-15', 'Makar Sankranti'], ['2027-03-06', 'Maha Shivratri'],
  ['2027-03-10', 'Eid ul-Fitr'], ['2027-03-22', 'Holi'], ['2027-03-26', 'Good Friday'],
  ['2027-04-15', 'Ram Navami'], ['2027-04-19', 'Mahavir Jayanti'], ['2027-05-17', 'Eid ul-Adha (Bakrid)'],
  ['2027-05-20', 'Buddha Purnima'], ['2027-08-17', 'Raksha Bandhan'], ['2027-08-25', 'Janmashtami'],
  ['2027-09-04', 'Ganesh Chaturthi'], ['2027-10-09', 'Dussehra'], ['2027-10-29', 'Diwali'],
  ['2027-11-14', 'Guru Nanak Jayanti'], ['2027-12-25', 'Christmas'],
];

// ── DISPUTED — held out of the seeded `muhurats` list, NOT deleted ────────────
// Encodes the cross-source disagreement so the knowledge survives. Resolution is
// a panchang-authority decision (Colonel Deepak), not a data fix — see
// docs/calendar-muhurat-conventions.md.
//
// (1) July 2026 cluster: valid under Drik's Devshayani Ekadashi = 25-Jul reading,
//     but ProKerala/AstroSage/mPanchang start Chaturmas ~6-Jul and drop them.
//     No independent source corroborates these four (2026-07-07 IS corroborated
//     and remains seeded).
const DISPUTED_MUHURATS = [
  ['2026-07-01', 'Uttara Ashadha', 'Dwitiya'],
  ['2026-07-06', 'Uttara Bhadrapada', 'Saptami'],
  ['2026-07-11', 'Rohini', 'Dwadashi'],
  ['2026-07-12', 'Rohini, Mrigashira', 'Trayodashi'],
];
// (2) January 2026 post-Sankranti dates: Drik + mPanchang list ZERO January
//     (Kharmas/Dhanurmas); ProKerala includes these four (>= 14-Jan, post Makar
//     Sankranti). Currently OMITTED (conservative) pending the same ruling.
const OMITTED_JANUARY = [
  ['2026-01-14', null, null],
  ['2026-01-23', null, null],
  ['2026-01-25', null, null],
  ['2026-01-28', null, null],
];

// ── Govt (nationwide secular gazetted holidays) ───────────────────────────────
const GOVT = [
  ['2026-01-26', 'Republic Day'], ['2026-08-15', 'Independence Day'], ['2026-10-02', 'Gandhi Jayanti'],
  ['2027-01-26', 'Republic Day'], ['2027-08-15', 'Independence Day'], ['2027-10-02', 'Gandhi Jayanti'],
];

// ── REGIONAL / COMMUNITY festival variants ────────────────────────────────────
// The SAME astronomical event lands on different dates and carries different
// names by region; a Tamil user wants Pongal, a Punjabi user wants Lohri. Seeded
// as kind=FESTIVAL with `region` set (NOT kind=REGIONAL) so a kind=FESTIVAL query
// still surfaces them and the region column discriminates. `region` uses canonical
// Indian state names (matches vendors.state); `community` (e.g. 'Jain') uses the
// community_zones.community vocabulary and is region-agnostic.
//
// Every date below is corroborated by ≥2 public references (Drik Panchang +
// ProKerala/Calendar Labs/National Today/state-specific sources, June 2026). The
// solar Sankranti-cluster dates share the astronomical anchor already seeded as
// the national Makar/Mesha Sankranti rows. Cross-source deltas and the ±1-day
// solar-timing ambiguities that could not be cleanly resolved are NOT seeded —
// they live in DISPUTED_REGIONAL below (encoded, not deleted), exactly like the
// July muhurat cluster. See docs/calendar-muhurat-conventions.md.
//
// Row shape: [ISO date, name, region|null, community|null, astronomicalEvent|null, note?]
const REGIONAL_FESTIVALS = [
  // Makar Sankranti cluster (mid-Jan, solar — Sun enters Makara/Capricorn) ──────
  ['2026-01-13', 'Lohri', 'Punjab', null, 'Makar Sankranti', 'Eve of Sankranti; rabi-harvest bonfire'],
  ['2026-01-14', 'Pongal', 'Tamil Nadu', null, 'Makar Sankranti', 'Thai Pongal = Sankranti day (one source lists 15-Jan)'],
  ['2026-01-14', 'Uttarayan', 'Gujarat', null, 'Makar Sankranti', 'Kite festival on the Sankranti day'],
  ['2026-01-15', 'Magh Bihu', 'Assam', null, 'Makar Sankranti', 'Bhogali Bihu, day after Sankranti'],
  // Lunar New Year (Chaitra Shukla Pratipada, late Mar) ────────────────────────
  ['2026-03-19', 'Ugadi', 'Karnataka', null, 'Chaitra Shukla Pratipada', 'Telugu/Kannada New Year'],
  ['2026-03-19', 'Gudi Padwa', 'Maharashtra', null, 'Chaitra Shukla Pratipada', 'Marathi New Year (same tithi as Ugadi)'],
  // Mesha Sankranti solar New Year cluster (mid-Apr, Sun enters Mesha/Aries) ────
  ['2026-04-14', 'Puthandu', 'Tamil Nadu', null, 'Mesha Sankranti', 'Tamil New Year (Chittirai 1)'],
  ['2026-04-14', 'Vaisakhi', 'Punjab', null, 'Mesha Sankranti', 'Baisakhi; Sikh new year / harvest'],
  ['2026-04-15', 'Rongali Bihu', 'Assam', null, 'Mesha Sankranti', 'Bohag Bihu — Assamese New Year day'],
  ['2026-04-15', 'Pohela Boishakh', 'West Bengal', null, 'Mesha Sankranti', 'Bengali New Year (WB India convention)'],
  // Major regional observances ─────────────────────────────────────────────────
  ['2026-09-15', 'Paryushan (Samvatsari)', null, 'Jain', null, 'Svetambara Samvatsari — community, not region-bound'],
  ['2026-10-19', 'Durga Puja (Maha Ashtami)', 'West Bengal', null, null, 'Iconic WB Durga Puja day; national Dussehra is 20-Oct'],
  ['2026-11-15', 'Chhath Puja', 'Bihar', null, null, 'Main Sandhya Arghya day (6 days after Diwali)'],

  // ── 2027 ──────────────────────────────────────────────────────────────────
  ['2027-01-13', 'Lohri', 'Punjab', null, 'Makar Sankranti', 'Eve of Sankranti'],
  ['2027-01-15', 'Pongal', 'Tamil Nadu', null, 'Makar Sankranti', 'Aligns with national Makar Sankranti 15-Jan-2027'],
  ['2027-01-15', 'Uttarayan', 'Gujarat', null, 'Makar Sankranti', 'Kite festival on the Sankranti day'],
  ['2027-04-07', 'Ugadi', 'Karnataka', null, 'Chaitra Shukla Pratipada', 'Telugu/Kannada New Year'],
  ['2027-04-07', 'Gudi Padwa', 'Maharashtra', null, 'Chaitra Shukla Pratipada', 'Marathi New Year'],
  ['2027-04-14', 'Puthandu', 'Tamil Nadu', null, 'Mesha Sankranti', 'Tamil New Year (Chittirai 1)'],
  ['2027-04-14', 'Vaisakhi', 'Punjab', null, 'Mesha Sankranti', 'Baisakhi'],
  ['2027-04-15', 'Rongali Bihu', 'Assam', null, 'Mesha Sankranti', 'Bohag Bihu — Assamese New Year day'],
  ['2027-04-15', 'Pohela Boishakh', 'West Bengal', null, 'Mesha Sankranti', 'Bengali New Year'],
  ['2027-10-07', 'Durga Puja (Maha Ashtami)', 'West Bengal', null, null, 'Maha Ashtami 7-Oct-2027 (Drik)'],
  ['2027-11-04', 'Chhath Puja', 'Bihar', null, null, 'Main Sandhya Arghya day'],
];

// ── DISPUTED REGIONAL — held out of the seeded list, NOT deleted ──────────────
// Cross-source disagreements that a panchang-authority ruling (Colonel Deepak)
// must settle — same policy as the July muhurat cluster. Encoded so the
// knowledge survives; never seeded.
//   Row shape: [ISO date, name, region, note]
const DISPUTED_REGIONAL = [
  ['2026-04-14', 'Vishu', 'Kerala', 'Medam Sankranti timing splits sources Apr 14 vs Apr 15 (Vishukkani next-day rule).'],
  ['2026-08-26', 'Onam (Thiruvonam)', 'Kerala', 'Majority/Drik list 26-Aug; some list 1-Sep — Thiruvonam-nakshatra reckoning split (6-day delta).'],
];

const dataset = {
  version: SOURCE,
  generatedFor: [2026, 2027],
  reference: 'Drik Panchang (shubh vivah muhurats + Indian calendar 2026/2027)',
  chaturmas: {
    // Weddings blocked in [devshayani, devuthani) — devuthani day weddings resume.
    2026: { devshayani: '2026-07-25', devuthani: '2026-11-21' },
    2027: { devshayani: '2027-07-15', devuthani: '2027-11-10' },
  },
  muhurats: [...MUHURATS_2026, ...MUHURATS_2027].map(([date, nakshatra, tithi]) => ({
    date,
    band: bandFor(nakshatra),
    tithi,
    nakshatra,
  })),
  festivals: FESTIVALS.map(([date, name]) => ({ date, name })),
  // Regional / community festival variants (kind=FESTIVAL + region/community).
  regionalFestivals: REGIONAL_FESTIVALS.map(([date, name, region, community, astronomicalEvent, note]) => ({
    date,
    name,
    region: region ?? null,
    community: community ?? null,
    astronomicalEvent: astronomicalEvent ?? null,
    note: note ?? null,
  })),
  govt: GOVT.map(([date, name]) => ({ date, name })),
  // Documented cross-source disagreements — NOT seeded. See conventions doc.
  disputed: {
    reason:
      'Panchang-convention dependent (Devshayani Ekadashi reckoning; Kharmas end). ' +
      'Resolution is an authority decision, not a data fix. ' +
      'See docs/calendar-muhurat-conventions.md.',
    julyPendingAuthority: DISPUTED_MUHURATS.map(([date, tithi, nakshatra]) => ({
      date,
      band: bandFor(nakshatra),
      tithi,
      nakshatra,
      note: 'Valid under Drik (Devshayani=25-Jul); rejected by July-6 camp; not independently corroborated.',
    })),
    januaryOmittedPendingAuthority: OMITTED_JANUARY.map(([date]) => ({
      date,
      note: 'Listed by ProKerala (post-Makar-Sankranti); omitted by Drik/mPanchang (Kharmas). Currently NOT seeded.',
    })),
    regionalPendingAuthority: DISPUTED_REGIONAL.map(([date, name, region, note]) => ({
      date,
      name,
      region,
      note,
    })),
  },
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'calendar-2026-2027.json');
writeFileSync(outPath, JSON.stringify(dataset, null, 2) + '\n');
const regionalByRegion = dataset.regionalFestivals.reduce((acc, r) => {
  const key = r.community ? `community:${r.community}` : (r.region ?? 'national');
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `Wrote ${outPath}\n` +
    `  muhurats (seeded): ${dataset.muhurats.length} ` +
    `(2026=${MUHURATS_2026.length}, 2027=${MUHURATS_2027.length})\n` +
    `  festivals (national): ${dataset.festivals.length}  govt: ${dataset.govt.length}\n` +
    `  regionalFestivals (seeded): ${dataset.regionalFestivals.length} ` +
    `→ ${JSON.stringify(regionalByRegion)}\n` +
    `  disputed (NOT seeded): july=${dataset.disputed.julyPendingAuthority.length}, ` +
    `january-omitted=${dataset.disputed.januaryOmittedPendingAuthority.length}, ` +
    `regional=${dataset.disputed.regionalPendingAuthority.length}`,
);
