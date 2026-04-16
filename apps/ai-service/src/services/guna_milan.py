"""
Guna Milan — Ashtakoot Compatibility Calculator
North Indian System (standard 8-factor, 36-point scale)

This is deterministic Vedic astrology mathematics.
No LLM or ML is used. All results come from classical lookup tables
as used in the North Indian (Parashari) tradition.

Reference: guna-milan-v1.md (prompts/)
Output interface: GunaResult in packages/types/src/matching.ts
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# 1. LOOKUP TABLES
# ---------------------------------------------------------------------------

# All 27 Nakshatras in order (index 0 = Ashwini ... index 26 = Revati)
NAKSHATRAS: list[str] = [
    "Ashwini",          # 0
    "Bharani",          # 1
    "Krittika",         # 2
    "Rohini",           # 3
    "Mrigashira",       # 4
    "Ardra",            # 5
    "Punarvasu",        # 6
    "Pushya",           # 7
    "Ashlesha",         # 8
    "Magha",            # 9
    "Purva Phalguni",   # 10
    "Uttara Phalguni",  # 11
    "Hasta",            # 12
    "Chitra",           # 13
    "Swati",            # 14
    "Vishakha",         # 15
    "Anuradha",         # 16
    "Jyeshtha",         # 17
    "Mula",             # 18
    "Purva Ashadha",    # 19
    "Uttara Ashadha",   # 20
    "Shravana",         # 21
    "Dhanishtha",       # 22
    "Shatabhisha",      # 23
    "Purva Bhadrapada", # 24
    "Uttara Bhadrapada",# 25
    "Revati",           # 26
]

# Build a reverse lookup: Nakshatra name → 0-based index
NAKSHATRA_INDEX: dict[str, int] = {name: i for i, name in enumerate(NAKSHATRAS)}

# All 12 Rashis (moon signs) in order (index 0 = Mesha ... index 11 = Meena)
RASHIS: list[str] = [
    "Mesha",      # 0  Aries
    "Vrishabha",  # 1  Taurus
    "Mithuna",    # 2  Gemini
    "Karka",      # 3  Cancer
    "Simha",      # 4  Leo
    "Kanya",      # 5  Virgo
    "Tula",       # 6  Libra
    "Vrishchika", # 7  Scorpio
    "Dhanu",      # 8  Sagittarius
    "Makara",     # 9  Capricorn
    "Kumbha",     # 10 Aquarius
    "Meena",      # 11 Pisces
]

RASHI_INDEX: dict[str, int] = {name: i for i, name in enumerate(RASHIS)}

# --- Varna (factor 1, max 1) ---
# Rashi → Varna rank (higher = more refined; Brahmin=4, Kshatriya=3, Vaishya=2, Shudra=1)
# Water signs = Brahmin (highest spiritual), Fire = Kshatriya,
# Earth = Vaishya, Air = Shudra (standard North Indian mapping)
RASHI_VARNA: dict[str, int] = {
    "Karka":      4,  # Brahmin (water)
    "Vrishchika": 4,  # Brahmin (water)
    "Meena":      4,  # Brahmin (water)
    "Mesha":      3,  # Kshatriya (fire)
    "Simha":      3,  # Kshatriya (fire)
    "Dhanu":      3,  # Kshatriya (fire)
    "Vrishabha":  2,  # Vaishya (earth)
    "Kanya":      2,  # Vaishya (earth)
    "Makara":     2,  # Vaishya (earth)
    "Mithuna":    1,  # Shudra (air)
    "Tula":       1,  # Shudra (air)
    "Kumbha":     1,  # Shudra (air)
}

# --- Vashya (factor 2, max 2) ---
# Rashi → Vashya group (5 groups)
# 1=Chatushpad, 2=Dwipad, 3=Jalachara, 4=Keet, 5=Vanachara
RASHI_VASHYA: dict[str, int] = {
    "Mesha":      1,  # Chatushpad (4-legged)
    "Vrishabha":  1,  # Chatushpad
    "Mithuna":    2,  # Dwipad (2-legged)
    "Karka":      3,  # Jalachara (water)
    "Simha":      5,  # Vanachara (wild/forest)
    "Kanya":      2,  # Dwipad
    "Tula":       2,  # Dwipad
    "Vrishchika": 4,  # Keet (insect)
    "Dhanu":      1,  # Chatushpad (hind half)
    "Makara":     3,  # Jalachara (fore half = Dwipad, but generally Jalachara)
    "Kumbha":     2,  # Dwipad
    "Meena":      3,  # Jalachara
}

# Vashya score matrix: VASHYA_SCORE[(boy_group, girl_group)] → score (0, 1, or 2)
# 2 = mutual Vashya (fully compatible)
# 1 = one-way Vashya
# 0 = no Vashya
# Based on standard North Indian Vashya table
_VS = {
    # same group always = 2
    (1, 1): 2, (2, 2): 2, (3, 3): 2, (4, 4): 2, (5, 5): 2,
    # Chatushpad(1) relationships
    (1, 2): 1, (2, 1): 1,
    (1, 5): 1, (5, 1): 1,
    # Dwipad(2) relationships
    (2, 3): 1, (3, 2): 1,
    # Jalachara(3) relationships
    (3, 4): 1, (4, 3): 1,
    # Keet(4) relationships
    (4, 5): 1, (5, 4): 1,
    # Vanachara(5) relationships
    (5, 2): 1, (2, 5): 1,
}

def _vashya_score(boy_group: int, girl_group: int) -> int:
    return _VS.get((boy_group, girl_group), 0)


# --- Yoni (factor 4, max 4) ---
# Nakshatra → Yoni animal (14 animals)
NAKSHATRA_YONI: dict[str, str] = {
    "Ashwini":           "Ashwa",    # Horse
    "Shatabhisha":       "Ashwa",    # Horse
    "Bharani":           "Gaja",     # Elephant
    "Revati":            "Gaja",     # Elephant
    "Pushya":            "Mesha",    # Ram/Sheep
    "Krittika":          "Mesha",    # Ram/Sheep
    "Rohini":            "Sarpa",    # Serpent
    "Mrigashira":        "Sarpa",    # Serpent
    "Ardra":             "Shwana",   # Dog
    "Mula":              "Shwana",   # Dog
    "Punarvasu":         "Marjara",  # Cat
    "Ashlesha":          "Marjara",  # Cat
    "Magha":             "Mushaka",  # Rat
    "Purva Phalguni":    "Mushaka",  # Rat
    "Uttara Phalguni":   "Gau",      # Cow/Bull
    "Uttara Bhadrapada": "Gau",      # Cow/Bull
    "Hasta":             "Mahisha",  # Buffalo
    "Swati":             "Mahisha",  # Buffalo
    "Chitra":            "Vyaghra",  # Tiger
    "Vishakha":          "Vyaghra",  # Tiger
    "Anuradha":          "Mriga",    # Deer/Hare
    "Jyeshtha":          "Mriga",    # Deer/Hare
    "Purva Ashadha":     "Vanara",   # Monkey
    "Shravana":          "Vanara",   # Monkey
    "Uttara Ashadha":    "Nakula",   # Mongoose
    "Dhanishtha":        "Simha",    # Lion
    "Purva Bhadrapada":  "Simha",    # Lion
}

# Natural enemies among Yoni animals (bidirectional)
_YONI_ENEMIES: set[frozenset[str]] = {
    frozenset({"Gau", "Vyaghra"}),    # Cow vs Tiger
    frozenset({"Gaja", "Simha"}),     # Elephant vs Lion
    frozenset({"Ashwa", "Mahisha"}),  # Horse vs Buffalo
    frozenset({"Shwana", "Mriga"}),   # Dog vs Deer
    frozenset({"Sarpa", "Nakula"}),   # Serpent vs Mongoose
    frozenset({"Mushaka", "Marjara"}),# Rat vs Cat
    frozenset({"Vanara", "Mesha"}),   # Monkey vs Ram
}

# Friendly Yoni pairs (bidirectional, not same)
_YONI_FRIENDS: set[frozenset[str]] = {
    frozenset({"Ashwa", "Ashwa"}),     # (handled by same-yoni rule)
    frozenset({"Gau", "Mahisha"}),     # Cow and Buffalo (both cattle)
    frozenset({"Mriga", "Vanara"}),    # Deer and Monkey (forest animals)
    frozenset({"Simha", "Vyaghra"}),   # Lion and Tiger (big cats)
    frozenset({"Gaja", "Mesha"}),      # Elephant and Ram
    frozenset({"Shwana", "Marjara"}),  # Dog and Cat (domestic, partial friend)
    frozenset({"Sarpa", "Mushaka"}),   # Serpent and Rat (neutral-friend)
    frozenset({"Ashwa", "Gaja"}),      # Horse and Elephant
    frozenset({"Nakula", "Mriga"}),    # Mongoose and Deer
    frozenset({"Punarvasu", "Ashlesha"}), # not animals — skip
}

# Simplified Yoni score function
def _yoni_score(boy_nak: str, girl_nak: str) -> int:
    """
    Score: 4=same yoni, 3=friendly, 2=neutral, 1=enemy, 0=hostile enemy
    Uses the standard North Indian Yoni compatibility rules.
    """
    boy_yoni = NAKSHATRA_YONI.get(boy_nak)
    girl_yoni = NAKSHATRA_YONI.get(girl_nak)
    if boy_yoni is None or girl_yoni is None:
        return 0  # unknown Nakshatra → graceful fallback

    if boy_yoni == girl_yoni:
        return 4  # same yoni (best)

    pair = frozenset({boy_yoni, girl_yoni})
    if pair in _YONI_ENEMIES:
        return 0  # natural enemies → 0

    # Friendly pairs (partially defined above — use a clean set)
    _CLEAN_FRIENDS: set[frozenset[str]] = {
        frozenset({"Gau", "Mahisha"}),
        frozenset({"Simha", "Vyaghra"}),
        frozenset({"Gaja", "Mesha"}),
        frozenset({"Mriga", "Vanara"}),
        frozenset({"Ashwa", "Gaja"}),
    }
    if pair in _CLEAN_FRIENDS:
        return 3  # friendly

    return 2  # neutral


# --- Graha Maitri (factor 5, max 5) ---
# Rashi → ruling planet
RASHI_LORD: dict[str, str] = {
    "Mesha":      "Mars",
    "Vrishabha":  "Venus",
    "Mithuna":    "Mercury",
    "Karka":      "Moon",
    "Simha":      "Sun",
    "Kanya":      "Mercury",
    "Tula":       "Venus",
    "Vrishchika": "Mars",
    "Dhanu":      "Jupiter",
    "Makara":     "Saturn",
    "Kumbha":     "Saturn",
    "Meena":      "Jupiter",
}

# Planetary relationships: planet → {friend, neutral, enemy}
_PLANET_FRIENDS: dict[str, set[str]] = {
    "Sun":     {"Moon", "Mars", "Jupiter"},
    "Moon":    {"Sun", "Mercury"},
    "Mars":    {"Sun", "Moon", "Jupiter"},
    "Mercury": {"Sun", "Venus"},
    "Jupiter": {"Sun", "Moon", "Mars"},
    "Venus":   {"Mercury", "Saturn"},
    "Saturn":  {"Mercury", "Venus"},
}
_PLANET_NEUTRAL: dict[str, set[str]] = {
    "Sun":     {"Mercury"},
    "Moon":    {"Mars", "Jupiter", "Venus", "Saturn"},
    "Mars":    {"Venus", "Saturn"},
    "Mercury": {"Mars", "Jupiter", "Saturn"},
    "Jupiter": {"Saturn"},
    "Venus":   {"Mars", "Jupiter"},
    "Saturn":  {"Jupiter"},
}

def _planet_relation(p1: str, p2: str) -> str:
    """Return 'friend', 'neutral', or 'enemy' from p1's perspective toward p2."""
    if p1 == p2:
        return "friend"  # same planet = friend
    if p2 in _PLANET_FRIENDS.get(p1, set()):
        return "friend"
    if p2 in _PLANET_NEUTRAL.get(p1, set()):
        return "neutral"
    return "enemy"

def _graha_maitri_score(boy_rashi: str, girl_rashi: str) -> int:
    """
    Score based on planetary friendship between moon sign lords.
    5 = both friends / same lord
    4 = one friend + one neutral
    3 = both neutral
    2 = (unused in strict table, treat neutral+enemy)
    1 = one friend + one enemy
    0 = both enemy / one neutral + one enemy
    """
    boy_lord = RASHI_LORD.get(boy_rashi)
    girl_lord = RASHI_LORD.get(girl_rashi)
    if boy_lord is None or girl_lord is None:
        return 0  # unknown Rashi

    # Relation from each side
    b2g = _planet_relation(boy_lord, girl_lord)
    g2b = _planet_relation(girl_lord, boy_lord)

    _rel_rank = {"friend": 2, "neutral": 1, "enemy": 0}
    pair_rank = (_rel_rank[b2g], _rel_rank[g2b])

    if pair_rank == (2, 2):
        return 5  # mutual friends
    if pair_rank in {(2, 1), (1, 2)}:
        return 4  # friend + neutral
    if pair_rank == (1, 1):
        return 3  # both neutral
    if pair_rank in {(2, 0), (0, 2)}:
        return 1  # friend + enemy
    # (1, 0), (0, 1), (0, 0)
    return 0


# --- Gana (factor 6, max 6) ---
# Nakshatra → Gana
NAKSHATRA_GANA: dict[str, str] = {
    # Dev Gana (divine)
    "Ashwini":           "Dev",
    "Mrigashira":        "Dev",
    "Punarvasu":         "Dev",
    "Pushya":            "Dev",
    "Hasta":             "Dev",
    "Swati":             "Dev",
    "Anuradha":          "Dev",
    "Shravana":          "Dev",
    "Revati":            "Dev",
    # Manav Gana (human)
    "Bharani":           "Manav",
    "Rohini":            "Manav",
    "Ardra":             "Manav",
    "Purva Phalguni":    "Manav",
    "Uttara Phalguni":   "Manav",
    "Purva Ashadha":     "Manav",
    "Uttara Ashadha":    "Manav",
    "Purva Bhadrapada":  "Manav",
    "Uttara Bhadrapada": "Manav",
    # Rakshasa Gana (demon)
    "Krittika":          "Rakshasa",
    "Ashlesha":          "Rakshasa",
    "Magha":             "Rakshasa",
    "Chitra":            "Rakshasa",
    "Vishakha":          "Rakshasa",
    "Jyeshtha":          "Rakshasa",
    "Mula":              "Rakshasa",
    "Dhanishtha":        "Rakshasa",
    "Shatabhisha":       "Rakshasa",
}

# Gana score: GANA_SCORE[(boy_gana, girl_gana)] → score
GANA_SCORE: dict[tuple[str, str], int] = {
    ("Dev",      "Dev"):      6,
    ("Manav",    "Manav"):    6,
    ("Rakshasa", "Rakshasa"): 6,
    ("Dev",      "Manav"):    5,
    ("Manav",    "Dev"):      5,
    ("Dev",      "Rakshasa"): 1,
    ("Rakshasa", "Dev"):      1,
    ("Manav",    "Rakshasa"): 0,
    ("Rakshasa", "Manav"):    0,
}


# --- Nadi (factor 8, max 8) ---
# Nakshatra → Nadi
NAKSHATRA_NADI: dict[str, str] = {
    # Aadi Nadi (Vata)
    "Ashwini":           "Aadi",
    "Ardra":             "Aadi",
    "Punarvasu":         "Aadi",
    "Uttara Phalguni":   "Aadi",
    "Hasta":             "Aadi",
    "Jyeshtha":          "Aadi",
    "Mula":              "Aadi",
    "Shatabhisha":       "Aadi",
    "Purva Bhadrapada":  "Aadi",
    # Madhya Nadi (Pitta)
    "Bharani":           "Madhya",
    "Mrigashira":        "Madhya",
    "Pushya":            "Madhya",
    "Purva Phalguni":    "Madhya",
    "Chitra":            "Madhya",
    "Anuradha":          "Madhya",
    "Purva Ashadha":     "Madhya",
    "Dhanishtha":        "Madhya",
    "Uttara Bhadrapada": "Madhya",
    # Antya Nadi (Kapha)
    "Krittika":          "Antya",
    "Rohini":            "Antya",
    "Ashlesha":          "Antya",
    "Magha":             "Antya",
    "Swati":             "Antya",
    "Vishakha":          "Antya",
    "Uttara Ashadha":    "Antya",
    "Shravana":          "Antya",
    "Revati":            "Antya",
}


# ---------------------------------------------------------------------------
# 2. FACTOR CALCULATORS
# ---------------------------------------------------------------------------

def calc_varna(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """Varna: 1 point if boy's Varna rank >= girl's Varna rank."""
    boy_rank = RASHI_VARNA.get(boy_rashi)
    girl_rank = RASHI_VARNA.get(girl_rashi)
    if boy_rank is None or girl_rank is None:
        return {"score": 0, "max": 1, "compatible": False}
    compatible = boy_rank >= girl_rank
    return {"score": 1 if compatible else 0, "max": 1, "compatible": compatible}


def calc_vashya(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """Vashya: 0–2 points based on group relationship."""
    boy_group = RASHI_VASHYA.get(boy_rashi)
    girl_group = RASHI_VASHYA.get(girl_rashi)
    if boy_group is None or girl_group is None:
        return {"score": 0, "max": 2, "compatible": False}
    score = _vashya_score(boy_group, girl_group)
    return {"score": score, "max": 2, "compatible": score > 0}


def calc_tara(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """
    Tara: 0, 1.5, or 3 points.
    Count from girl's Nakshatra to boy's, divide by 9, check remainder.
    Auspicious remainders: 1,3,5,7,0 (0 = 9th) are auspicious for boy; same check from girl.
    Standard: odd tara numbers (1,3,5,7) = inauspicious; even (2,4,6,8,0) = auspicious.
    Score: 3 if both auspicious, 1 (rounded to 1) if one auspicious, 0 if neither.
    Note: We return integer scores only (1 instead of 1.5) to keep totals clean.
    """
    boy_idx = NAKSHATRA_INDEX.get(boy_nak)
    girl_idx = NAKSHATRA_INDEX.get(girl_nak)
    if boy_idx is None or girl_idx is None:
        return {"score": 0, "max": 3, "compatible": False}

    # Count from girl to boy (1-based)
    count_b = ((boy_idx - girl_idx) % 27) + 1
    # Count from boy to girl (for reciprocal check)
    count_g = ((girl_idx - boy_idx) % 27) + 1

    tara_b = count_b % 9  # 0-based tara (0 means 9th)
    tara_g = count_g % 9

    # Auspicious if tara position is even (2,4,6,8) or 0 (represents 9th, also auspicious)
    # Inauspicious if odd (1,3,5,7)
    auspicious_b = (tara_b % 2 == 0)
    auspicious_g = (tara_g % 2 == 0)

    if auspicious_b and auspicious_g:
        score = 3
    elif auspicious_b or auspicious_g:
        score = 1  # partial (traditional 1.5 rounded to 1)
    else:
        score = 0
    return {"score": score, "max": 3, "compatible": score > 0}


def calc_yoni(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """Yoni: 0–4 points based on Nakshatra animal compatibility."""
    score = _yoni_score(boy_nak, girl_nak)
    return {"score": score, "max": 4, "compatible": score >= 2}


def calc_graha_maitri(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """Graha Maitri: 0–5 points based on planetary friendship."""
    score = _graha_maitri_score(boy_rashi, girl_rashi)
    return {"score": score, "max": 5, "compatible": score >= 3}


def calc_gana(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """Gana: 0–6 points based on Dev/Manav/Rakshasa classification."""
    boy_gana = NAKSHATRA_GANA.get(boy_nak)
    girl_gana = NAKSHATRA_GANA.get(girl_nak)
    if boy_gana is None or girl_gana is None:
        return {"score": 0, "max": 6, "compatible": False}
    score = GANA_SCORE.get((boy_gana, girl_gana), 0)
    return {"score": score, "max": 6, "compatible": score >= 5}


def calc_bhakoot(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """
    Bhakoot: 0 or 7 points.
    Inauspicious positions (from girl to boy, 1-based modulo 12):
      - 6-8 axis (shadashtak): positions 6 and 8
      - 5-9 axis (navamansh): positions 5 and 9
      - 2-12 axis (dwitiyadwadas): positions 2 and 12
    All other positions = 7 (auspicious).
    """
    boy_idx = RASHI_INDEX.get(boy_rashi)
    girl_idx = RASHI_INDEX.get(girl_rashi)
    if boy_idx is None or girl_idx is None:
        return {"score": 0, "max": 7, "compatible": False}

    # Count from girl Rashi to boy Rashi (1-based)
    count = ((boy_idx - girl_idx) % 12) + 1

    # Inauspicious axes (bidirectional: also check from boy to girl)
    count_rev = ((girl_idx - boy_idx) % 12) + 1

    _INAUSPICIOUS = {6, 8, 5, 9, 2, 12}
    if count in _INAUSPICIOUS or count_rev in _INAUSPICIOUS:
        return {"score": 0, "max": 7, "compatible": False}
    return {"score": 7, "max": 7, "compatible": True}


def calc_nadi(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """
    Nadi: 8 points if different Nadis, 0 if same Nadi.
    Same Nadi = genetic/health incompatibility in Vedic tradition.
    """
    boy_nadi = NAKSHATRA_NADI.get(boy_nak)
    girl_nadi = NAKSHATRA_NADI.get(girl_nak)
    if boy_nadi is None or girl_nadi is None:
        return {"score": 0, "max": 8, "compatible": False}
    compatible = boy_nadi != girl_nadi
    return {"score": 8 if compatible else 0, "max": 8, "compatible": compatible}


# ---------------------------------------------------------------------------
# 3. INTERPRETATION
# ---------------------------------------------------------------------------

def _interpret(score: int) -> tuple[str, str]:
    """
    Return (interpretation_label, recommendation_text) based on score.
    Thresholds from guna-milan-v1.md (North Indian standard):
      32–36 = Excellent match
      25–31 = Good match
      18–24 = Average match
       0–17 = Not recommended
    """
    if score >= 32:
        label = "Excellent match"
        rec = (
            "This is an excellent horoscope match. All major compatibility factors align well. "
            "The couple can look forward to a harmonious and prosperous life together."
        )
    elif score >= 25:
        label = "Good match"
        rec = (
            "This is a good match with strong compatibility across most factors. "
            "Minor differences can be resolved with mutual understanding and respect."
        )
    elif score >= 18:
        label = "Average match"
        rec = (
            "This is an average match. While there is basic compatibility, the couple "
            "should be aware of potential challenges and work actively to support each other."
        )
    else:
        label = "Not recommended"
        rec = (
            "This match scores below the recommended threshold. Several key compatibility "
            "factors are unfavourable. Consult a qualified astrologer before proceeding."
        )
    return label, rec


# ---------------------------------------------------------------------------
# 4. MAIN CALCULATOR
# ---------------------------------------------------------------------------

class GunaMilanCalculator:
    """
    Ashtakoot Guna Milan calculator (North Indian system).

    Inputs:
        boy_rashi:   Moon sign of the groom (e.g. "Mesha")
        boy_nak:     Birth Nakshatra of the groom (e.g. "Ashwini")
        girl_rashi:  Moon sign of the bride
        girl_nak:    Birth Nakshatra of the bride
        boy_manglik: Whether groom has Mangal Dosha
        girl_manglik:Whether bride has Mangal Dosha

    Returns a dict matching the GunaResult TypeScript interface
    (using snake_case keys as standard JSON convention).
    """

    def calculate(
        self,
        boy_rashi: str,
        boy_nak: str,
        girl_rashi: str,
        girl_nak: str,
        boy_manglik: bool,
        girl_manglik: bool,
    ) -> dict[str, Any]:
        factors: dict[str, dict[str, Any]] = {
            "varna":        calc_varna(boy_rashi, girl_rashi),
            "vashya":       calc_vashya(boy_rashi, girl_rashi),
            "tara":         calc_tara(boy_nak, girl_nak),
            "yoni":         calc_yoni(boy_nak, girl_nak),
            "graha_maitri": calc_graha_maitri(boy_rashi, girl_rashi),
            "gana":         calc_gana(boy_nak, girl_nak),
            "bhakoot":      calc_bhakoot(boy_rashi, girl_rashi),
            "nadi":         calc_nadi(boy_nak, girl_nak),
        }

        total_score: int = sum(f["score"] for f in factors.values())
        max_score: int = 36  # classical Ashtakoot maximum
        percentage: float = round(total_score / max_score * 100, 2)

        # Mangal Dosha conflict: one manglik + one non-manglik
        # Both manglik = cancelled (no conflict)
        mangal_dosha_conflict = boy_manglik != girl_manglik

        interpretation, recommendation = _interpret(total_score)

        return {
            "total_score":          total_score,
            "max_score":            max_score,
            "percentage":           percentage,
            "factors":              factors,
            "mangal_dosha_conflict": mangal_dosha_conflict,
            "interpretation":       interpretation,
            "recommendation":       recommendation,
        }


# Module-level singleton for import convenience
calculator = GunaMilanCalculator()
