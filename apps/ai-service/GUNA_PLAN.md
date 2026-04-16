# Guna Milan (Ashtakoot) — Implementation Plan

## System: North Indian (Parashari) tradition

All 8 Ashtakoot factors, 36-point scale. Deterministic lookup tables only.
No LLM. No ML.

## File Structure

```
apps/ai-service/src/
├── main.py                     (updated — router mounted)
├── routers/horoscope.py        (POST /ai/horoscope/guna)
├── schemas/horoscope.py        (Pydantic: HoroscopeProfile, GunaInput, GunaResultResponse)
└── services/guna_milan.py      (all 8 factors + GunaMilanCalculator)

apps/ai-service/tests/
└── test_guna_milan.py          (61 tests, 100% pass)
```

## All 8 Factors

| # | Factor | Max | Input | Method |
|---|--------|-----|-------|--------|
| 1 | Varna | 1 | Rashi | Boy rank >= Girl rank (Brahmin=4 > Shudra=1) |
| 2 | Vashya | 2 | Rashi | Group lookup: Chatushpad/Dwipad/Jalachara/Keet/Vanachara |
| 3 | Tara | 3 | Nakshatra | Count from girl→boy mod 9, auspicious if even position |
| 4 | Yoni | 4 | Nakshatra | 14 animals: same=4, enemy=0, friend=3, neutral=2 |
| 5 | Graha Maitri | 5 | Rashi | Planetary lord friendship (7 planets) |
| 6 | Gana | 6 | Nakshatra | Dev/Manav/Rakshasa — same=6, cross=0–5 |
| 7 | Bhakoot | 7 | Rashi | Relative Rashi position; 6-8/5-9/2-12 axes = 0 |
| 8 | Nadi | 8 | Nakshatra | Different Nadi=8, same=0 (genetic) |

## Score Thresholds (guna-milan-v1.md)

- 32–36: Excellent match
- 25–31: Good match
- 18–24: Average match
- 0–17: Not recommended

## Mangal Dosha

Input: `manglik: bool` per profile. No house calculation.
- boy_manglik != girl_manglik → conflict = true
- both manglik → cancelled → conflict = false

## API Schema

```
POST /ai/horoscope/guna
Body: { profile_a: {rashi, nakshatra, manglik}, profile_b: {rashi, nakshatra, manglik} }
Response: { total_score, max_score, percentage, factors{...}, mangal_dosha_conflict, interpretation, recommendation }
```

## Status: COMPLETE — 62/62 tests passing
