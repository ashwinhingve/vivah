# Guna Milan Compatibility Analysis — System Prompt v1
# Used by: apps/ai-service/routers/horoscope.py
# Model: No LLM — this is a deterministic algorithm, not AI inference
# File kept here for documentation and context purposes only

## Ashtakoot System — 8 Factors, 36 Total Points

The Guna Milan algorithm is implemented as pure Python logic in:
`apps/ai-service/services/guna_milan.py`

This is deterministic Vedic astrology mathematics. It does NOT call any LLM.

### Factor Reference

| Factor | Points | Based On | What It Evaluates |
|--------|--------|----------|------------------|
| Varna | 1 | Caste type of moon sign | Spiritual and character alignment |
| Vashya | 2 | Vashya group of moon sign | Dominance and mutual control |
| Tara | 3 | Nakshatra count from birth star | Health and mutual well-being |
| Yoni | 4 | Animal symbol of Nakshatra | Physical and biological compatibility |
| Graha Maitri | 5 | Friendship between moon sign lords | Mental compatibility and intellectual bond |
| Gana | 6 | Deva / Manav / Rakshasa classification | Temperament and nature match |
| Bhakoot | 7 | Moon sign relationship | Emotional compatibility and prosperity |
| Nadi | 8 | Nadi (Adi / Madhya / Antya) of Nakshatra | Genetic and physical compatibility |

### Mangal Dosha

Checked separately — not part of the 36-point score.
A person has Mangal Dosha if Mars (Mangal) is in houses 1, 2, 4, 7, 8, or 12 from the Lagna (ascendant) or Moon sign.

If both partners have Mangal Dosha, it is considered cancelled.
If only one has it, flag in the response as `mangal_dosha_conflict: true`.

### Score Interpretation

| Score | Interpretation |
|-------|---------------|
| 0–17 | Not recommended |
| 18–24 | Average match |
| 25–31 | Good match |
| 32–36 | Excellent match |

### Input Required

- `dob`: Date of birth (YYYY-MM-DD)
- `tob`: Time of birth (HH:MM, 24h format)
- `pob`: Place of birth (city, state, country — for timezone calculation)
- Or pre-computed: `rashi` (moon sign), `nakshatra` (birth star index 1–27)

### Output Structure

```python
{
  "total_score": int,          # 0–36
  "max_score": 36,
  "percentage": float,         # total/36 * 100
  "factors": {
    "varna":        {"score": int, "max": 1, "compatible": bool},
    "vashya":       {"score": int, "max": 2, "compatible": bool},
    "tara":         {"score": int, "max": 3, "compatible": bool},
    "yoni":         {"score": int, "max": 4, "compatible": bool},
    "graha_maitri": {"score": int, "max": 5, "compatible": bool},
    "gana":         {"score": int, "max": 6, "compatible": bool},
    "bhakoot":      {"score": int, "max": 7, "compatible": bool},
    "nadi":         {"score": int, "max": 8, "compatible": bool},
  },
  "mangal_dosha_conflict": bool,
  "interpretation": str,       # "Excellent match" | "Good match" | etc.
  "recommendation": str        # Brief plain-language summary
}
```
