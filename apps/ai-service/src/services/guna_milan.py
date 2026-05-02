"""
Guna Milan — Advanced Ashtakoot Compatibility Calculator
North Indian System (8-factor, 36-point) + Dosha Analysis + Yogas + Life-Domain Insights + Remedies

This is deterministic Vedic astrology mathematics. No LLM or ML.

Reference: guna-milan-v1.md (prompts/)
Output interface: GunaResult in packages/types/src/matching.ts
"""

from __future__ import annotations

from typing import Any, Literal

ManglikStatus = Literal["YES", "NO", "PARTIAL"]


# ---------------------------------------------------------------------------
# 1. LOOKUP TABLES — Nakshatras and Rashis
# ---------------------------------------------------------------------------

NAKSHATRAS: list[str] = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
    "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
    "Revati",
]
NAKSHATRA_INDEX: dict[str, int] = {name: i for i, name in enumerate(NAKSHATRAS)}

RASHIS: list[str] = [
    "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
]
RASHI_INDEX: dict[str, int] = {name: i for i, name in enumerate(RASHIS)}

RASHI_ENGLISH: dict[str, str] = {
    "Mesha": "Aries", "Vrishabha": "Taurus", "Mithuna": "Gemini",
    "Karka": "Cancer", "Simha": "Leo", "Kanya": "Virgo",
    "Tula": "Libra", "Vrishchika": "Scorpio", "Dhanu": "Sagittarius",
    "Makara": "Capricorn", "Kumbha": "Aquarius", "Meena": "Pisces",
}


# ---------------------------------------------------------------------------
# 2. ASHTAKOOT FACTOR LOOKUPS
# ---------------------------------------------------------------------------

# Varna (factor 1, max 1)
RASHI_VARNA: dict[str, int] = {
    "Karka": 4, "Vrishchika": 4, "Meena": 4,        # Brahmin
    "Mesha": 3, "Simha": 3, "Dhanu": 3,             # Kshatriya
    "Vrishabha": 2, "Kanya": 2, "Makara": 2,        # Vaishya
    "Mithuna": 1, "Tula": 1, "Kumbha": 1,           # Shudra
}
VARNA_LABEL: dict[int, str] = {4: "Brahmin", 3: "Kshatriya", 2: "Vaishya", 1: "Shudra"}

# Vashya (factor 2, max 2) — 5 groups
RASHI_VASHYA: dict[str, int] = {
    "Mesha": 1, "Vrishabha": 1, "Dhanu": 1,         # Chatushpad
    "Mithuna": 2, "Kanya": 2, "Tula": 2, "Kumbha": 2,  # Dwipad
    "Karka": 3, "Makara": 3, "Meena": 3,            # Jalachara
    "Vrishchika": 4,                                # Keet
    "Simha": 5,                                     # Vanachara
}
VASHYA_LABEL: dict[int, str] = {
    1: "Chatushpad (4-legged)", 2: "Dwipad (2-legged)",
    3: "Jalachara (water)", 4: "Keet (insect)", 5: "Vanachara (forest)",
}
_VS = {
    (1, 1): 2, (2, 2): 2, (3, 3): 2, (4, 4): 2, (5, 5): 2,
    (1, 2): 1, (2, 1): 1, (1, 5): 1, (5, 1): 1,
    (2, 3): 1, (3, 2): 1, (3, 4): 1, (4, 3): 1,
    (4, 5): 1, (5, 4): 1, (5, 2): 1, (2, 5): 1,
}

def _vashya_score(boy_group: int, girl_group: int) -> int:
    return _VS.get((boy_group, girl_group), 0)


# Yoni (factor 4, max 4)
NAKSHATRA_YONI: dict[str, str] = {
    "Ashwini": "Ashwa", "Shatabhisha": "Ashwa",
    "Bharani": "Gaja", "Revati": "Gaja",
    "Pushya": "Mesha", "Krittika": "Mesha",
    "Rohini": "Sarpa", "Mrigashira": "Sarpa",
    "Ardra": "Shwana", "Mula": "Shwana",
    "Punarvasu": "Marjara", "Ashlesha": "Marjara",
    "Magha": "Mushaka", "Purva Phalguni": "Mushaka",
    "Uttara Phalguni": "Gau", "Uttara Bhadrapada": "Gau",
    "Hasta": "Mahisha", "Swati": "Mahisha",
    "Chitra": "Vyaghra", "Vishakha": "Vyaghra",
    "Anuradha": "Mriga", "Jyeshtha": "Mriga",
    "Purva Ashadha": "Vanara", "Shravana": "Vanara",
    "Uttara Ashadha": "Nakula",
    "Dhanishtha": "Simha", "Purva Bhadrapada": "Simha",
}
YONI_LABEL: dict[str, str] = {
    "Ashwa": "Horse", "Gaja": "Elephant", "Mesha": "Ram", "Sarpa": "Serpent",
    "Shwana": "Dog", "Marjara": "Cat", "Mushaka": "Rat", "Gau": "Cow",
    "Mahisha": "Buffalo", "Vyaghra": "Tiger", "Mriga": "Deer", "Vanara": "Monkey",
    "Nakula": "Mongoose", "Simha": "Lion",
}

_YONI_ENEMIES: set[frozenset[str]] = {
    frozenset({"Gau", "Vyaghra"}), frozenset({"Gaja", "Simha"}),
    frozenset({"Ashwa", "Mahisha"}), frozenset({"Shwana", "Mriga"}),
    frozenset({"Sarpa", "Nakula"}), frozenset({"Mushaka", "Marjara"}),
    frozenset({"Vanara", "Mesha"}),
}
_YONI_FRIENDS_CLEAN: set[frozenset[str]] = {
    frozenset({"Gau", "Mahisha"}), frozenset({"Simha", "Vyaghra"}),
    frozenset({"Gaja", "Mesha"}), frozenset({"Mriga", "Vanara"}),
    frozenset({"Ashwa", "Gaja"}),
}

def _yoni_score(boy_nak: str, girl_nak: str) -> int:
    boy_yoni = NAKSHATRA_YONI.get(boy_nak)
    girl_yoni = NAKSHATRA_YONI.get(girl_nak)
    if boy_yoni is None or girl_yoni is None:
        return 0
    if boy_yoni == girl_yoni:
        return 4
    pair = frozenset({boy_yoni, girl_yoni})
    if pair in _YONI_ENEMIES:
        return 0
    if pair in _YONI_FRIENDS_CLEAN:
        return 3
    return 2


# Graha Maitri (factor 5, max 5)
RASHI_LORD: dict[str, str] = {
    "Mesha": "Mars", "Vrishabha": "Venus", "Mithuna": "Mercury",
    "Karka": "Moon", "Simha": "Sun", "Kanya": "Mercury",
    "Tula": "Venus", "Vrishchika": "Mars", "Dhanu": "Jupiter",
    "Makara": "Saturn", "Kumbha": "Saturn", "Meena": "Jupiter",
}
_PLANET_FRIENDS: dict[str, set[str]] = {
    "Sun": {"Moon", "Mars", "Jupiter"},
    "Moon": {"Sun", "Mercury"},
    "Mars": {"Sun", "Moon", "Jupiter"},
    "Mercury": {"Sun", "Venus"},
    "Jupiter": {"Sun", "Moon", "Mars"},
    "Venus": {"Mercury", "Saturn"},
    "Saturn": {"Mercury", "Venus"},
}
_PLANET_NEUTRAL: dict[str, set[str]] = {
    "Sun": {"Mercury"},
    "Moon": {"Mars", "Jupiter", "Venus", "Saturn"},
    "Mars": {"Venus", "Saturn"},
    "Mercury": {"Mars", "Jupiter", "Saturn"},
    "Jupiter": {"Saturn"},
    "Venus": {"Mars", "Jupiter"},
    "Saturn": {"Jupiter"},
}

def _planet_relation(p1: str, p2: str) -> str:
    if p1 == p2:
        return "friend"
    if p2 in _PLANET_FRIENDS.get(p1, set()):
        return "friend"
    if p2 in _PLANET_NEUTRAL.get(p1, set()):
        return "neutral"
    return "enemy"

def _graha_maitri_score(boy_rashi: str, girl_rashi: str) -> int:
    boy_lord = RASHI_LORD.get(boy_rashi)
    girl_lord = RASHI_LORD.get(girl_rashi)
    if boy_lord is None or girl_lord is None:
        return 0
    b2g = _planet_relation(boy_lord, girl_lord)
    g2b = _planet_relation(girl_lord, boy_lord)
    _rel_rank = {"friend": 2, "neutral": 1, "enemy": 0}
    pair_rank = (_rel_rank[b2g], _rel_rank[g2b])
    if pair_rank == (2, 2):
        return 5
    if pair_rank in {(2, 1), (1, 2)}:
        return 4
    if pair_rank == (1, 1):
        return 3
    if pair_rank in {(2, 0), (0, 2)}:
        return 1
    return 0


# Gana (factor 6, max 6)
NAKSHATRA_GANA: dict[str, str] = {
    "Ashwini": "Dev", "Mrigashira": "Dev", "Punarvasu": "Dev",
    "Pushya": "Dev", "Hasta": "Dev", "Swati": "Dev",
    "Anuradha": "Dev", "Shravana": "Dev", "Revati": "Dev",
    "Bharani": "Manav", "Rohini": "Manav", "Ardra": "Manav",
    "Purva Phalguni": "Manav", "Uttara Phalguni": "Manav",
    "Purva Ashadha": "Manav", "Uttara Ashadha": "Manav",
    "Purva Bhadrapada": "Manav", "Uttara Bhadrapada": "Manav",
    "Krittika": "Rakshasa", "Ashlesha": "Rakshasa", "Magha": "Rakshasa",
    "Chitra": "Rakshasa", "Vishakha": "Rakshasa", "Jyeshtha": "Rakshasa",
    "Mula": "Rakshasa", "Dhanishtha": "Rakshasa", "Shatabhisha": "Rakshasa",
}
GANA_SCORE: dict[tuple[str, str], int] = {
    ("Dev", "Dev"): 6, ("Manav", "Manav"): 6, ("Rakshasa", "Rakshasa"): 6,
    ("Dev", "Manav"): 5, ("Manav", "Dev"): 5,
    ("Dev", "Rakshasa"): 1, ("Rakshasa", "Dev"): 1,
    ("Manav", "Rakshasa"): 0, ("Rakshasa", "Manav"): 0,
}

# Nadi (factor 8, max 8)
NAKSHATRA_NADI: dict[str, str] = {
    "Ashwini": "Aadi", "Ardra": "Aadi", "Punarvasu": "Aadi",
    "Uttara Phalguni": "Aadi", "Hasta": "Aadi", "Jyeshtha": "Aadi",
    "Mula": "Aadi", "Shatabhisha": "Aadi", "Purva Bhadrapada": "Aadi",
    "Bharani": "Madhya", "Mrigashira": "Madhya", "Pushya": "Madhya",
    "Purva Phalguni": "Madhya", "Chitra": "Madhya", "Anuradha": "Madhya",
    "Purva Ashadha": "Madhya", "Dhanishtha": "Madhya", "Uttara Bhadrapada": "Madhya",
    "Krittika": "Antya", "Rohini": "Antya", "Ashlesha": "Antya",
    "Magha": "Antya", "Swati": "Antya", "Vishakha": "Antya",
    "Uttara Ashadha": "Antya", "Shravana": "Antya", "Revati": "Antya",
}
NADI_LABEL: dict[str, str] = {
    "Aadi": "Aadi (Vata)", "Madhya": "Madhya (Pitta)", "Antya": "Antya (Kapha)",
}


# ---------------------------------------------------------------------------
# 3. ADVANCED DOSHA TABLES
# ---------------------------------------------------------------------------

# Rajju Dosha — 5 parts of body. Same Rajju between bride+groom = dosha.
NAKSHATRA_RAJJU: dict[str, str] = {
    "Ashwini": "Pada", "Ashlesha": "Pada", "Magha": "Pada",
    "Jyeshtha": "Pada", "Mula": "Pada", "Revati": "Pada",
    "Bharani": "Kati", "Pushya": "Kati", "Purva Phalguni": "Kati",
    "Anuradha": "Kati", "Purva Ashadha": "Kati", "Uttara Bhadrapada": "Kati",
    "Krittika": "Nabhi", "Punarvasu": "Nabhi", "Uttara Phalguni": "Nabhi",
    "Vishakha": "Nabhi", "Uttara Ashadha": "Nabhi", "Purva Bhadrapada": "Nabhi",
    "Rohini": "Kantha", "Ardra": "Kantha", "Hasta": "Kantha",
    "Swati": "Kantha", "Shravana": "Kantha", "Shatabhisha": "Kantha",
    "Mrigashira": "Shira", "Chitra": "Shira", "Dhanishtha": "Shira",
}
RAJJU_LABEL: dict[str, str] = {
    "Pada": "Pada Rajju (feet)",
    "Kati": "Kati Rajju (waist)",
    "Nabhi": "Nabhi Rajju (navel)",
    "Kantha": "Kantha Rajju (throat)",
    "Shira": "Shira Rajju (head)",
}
# Severity if same Rajju (classical interpretation)
RAJJU_SEVERITY: dict[str, str] = {
    "Pada": "Travel/wandering troubles",
    "Kati": "Poverty / financial stress",
    "Nabhi": "Issues with progeny",
    "Kantha": "Threat to spouse's life",
    "Shira": "Threat to husband's life",
}

# Vedha Dosha — Nakshatra obstruction pairs (bidirectional)
_VEDHA_PAIRS: list[frozenset[str]] = [
    frozenset({"Ashwini", "Jyeshtha"}),
    frozenset({"Bharani", "Anuradha"}),
    frozenset({"Krittika", "Vishakha"}),
    frozenset({"Rohini", "Swati"}),
    frozenset({"Mrigashira", "Chitra"}),
    frozenset({"Ardra", "Hasta"}),
    frozenset({"Punarvasu", "Uttara Phalguni"}),
    frozenset({"Pushya", "Purva Phalguni"}),
    frozenset({"Ashlesha", "Magha"}),
    frozenset({"Mula", "Revati"}),
    frozenset({"Purva Ashadha", "Uttara Bhadrapada"}),
    frozenset({"Uttara Ashadha", "Purva Bhadrapada"}),
    frozenset({"Shravana", "Shatabhisha"}),
]
VEDHA_PAIR_SET: set[frozenset[str]] = set(_VEDHA_PAIRS)


# Mahendra Yoga auspicious counts (boy → girl Nakshatra)
_MAHENDRA_COUNTS: set[int] = {4, 7, 10, 13, 16, 19, 22, 25}


# Bhakoot inauspicious axes (1-based count from one Rashi to other)
_BHAKOOT_INAUSPICIOUS = {2, 5, 6, 8, 9, 12}


# ---------------------------------------------------------------------------
# 4. FACTOR DETAIL DESCRIPTIONS
# ---------------------------------------------------------------------------

FACTOR_META: dict[str, dict[str, str]] = {
    "varna": {
        "name": "Varna",
        "name_hi": "वर्ण",
        "max": "1",
        "domain": "spiritual",
        "meaning": (
            "Spiritual & mental temperament. The groom's Varna should equal or exceed the bride's "
            "for harmony of values."
        ),
    },
    "vashya": {
        "name": "Vashya",
        "name_hi": "वश्य",
        "max": "2",
        "domain": "control",
        "meaning": "Mutual influence and attraction between the two partners.",
    },
    "tara": {
        "name": "Tara",
        "name_hi": "तारा",
        "max": "3",
        "domain": "destiny",
        "meaning": "Birth-star auspiciousness counted from each partner's Nakshatra. Health & destiny.",
    },
    "yoni": {
        "name": "Yoni",
        "name_hi": "योनि",
        "max": "4",
        "domain": "intimacy",
        "meaning": "Sexual & physical compatibility based on the Nakshatra animal symbolism.",
    },
    "graha_maitri": {
        "name": "Graha Maitri",
        "name_hi": "ग्रह मैत्री",
        "max": "5",
        "domain": "intellect",
        "meaning": "Mental friendship through compatibility of the Moon-sign ruling planets.",
    },
    "gana": {
        "name": "Gana",
        "name_hi": "गण",
        "max": "6",
        "domain": "temperament",
        "meaning": "Nature of the soul — Dev (divine), Manav (human), or Rakshasa (demonic).",
    },
    "bhakoot": {
        "name": "Bhakoot",
        "name_hi": "भकूट",
        "max": "7",
        "domain": "prosperity",
        "meaning": "Family welfare, finance, and emotional bond by Moon-sign placement axis.",
    },
    "nadi": {
        "name": "Nadi",
        "name_hi": "नाड़ी",
        "max": "8",
        "domain": "health",
        "meaning": (
            "Genetic & health compatibility. Same Nadi indicates similar physiology — classically "
            "discouraged for progeny."
        ),
    },
}


def _factor_status(score: int, max_v: int) -> str:
    if max_v == 0:
        return "neutral"
    ratio = score / max_v
    if ratio >= 0.85:
        return "excellent"
    if ratio >= 0.6:
        return "good"
    if ratio >= 0.34:
        return "average"
    return "low"


# ---------------------------------------------------------------------------
# 5. ASHTAKOOT FACTOR CALCULATORS
# ---------------------------------------------------------------------------

def calc_varna(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    boy_rank = RASHI_VARNA.get(boy_rashi)
    girl_rank = RASHI_VARNA.get(girl_rashi)
    if boy_rank is None or girl_rank is None:
        return {"score": 0, "max": 1, "compatible": False,
                "boy_value": None, "girl_value": None}
    compatible = boy_rank >= girl_rank
    return {
        "score": 1 if compatible else 0, "max": 1, "compatible": compatible,
        "boy_value": VARNA_LABEL.get(boy_rank),
        "girl_value": VARNA_LABEL.get(girl_rank),
    }


def calc_vashya(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    boy_group = RASHI_VASHYA.get(boy_rashi)
    girl_group = RASHI_VASHYA.get(girl_rashi)
    if boy_group is None or girl_group is None:
        return {"score": 0, "max": 2, "compatible": False,
                "boy_value": None, "girl_value": None}
    score = _vashya_score(boy_group, girl_group)
    return {
        "score": score, "max": 2, "compatible": score > 0,
        "boy_value": VASHYA_LABEL.get(boy_group),
        "girl_value": VASHYA_LABEL.get(girl_group),
    }


def calc_tara(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    boy_idx = NAKSHATRA_INDEX.get(boy_nak)
    girl_idx = NAKSHATRA_INDEX.get(girl_nak)
    if boy_idx is None or girl_idx is None:
        return {"score": 0, "max": 3, "compatible": False,
                "boy_value": None, "girl_value": None}
    count_b = ((boy_idx - girl_idx) % 27) + 1
    count_g = ((girl_idx - boy_idx) % 27) + 1
    tara_b = count_b % 9
    tara_g = count_g % 9
    auspicious_b = (tara_b % 2 == 0)
    auspicious_g = (tara_g % 2 == 0)
    if auspicious_b and auspicious_g:
        score = 3
    elif auspicious_b or auspicious_g:
        score = 1
    else:
        score = 0
    return {
        "score": score, "max": 3, "compatible": score > 0,
        "boy_value": f"Tara #{tara_b or 9}",
        "girl_value": f"Tara #{tara_g or 9}",
    }


def calc_yoni(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    score = _yoni_score(boy_nak, girl_nak)
    boy_y = NAKSHATRA_YONI.get(boy_nak)
    girl_y = NAKSHATRA_YONI.get(girl_nak)
    return {
        "score": score, "max": 4, "compatible": score >= 2,
        "boy_value": YONI_LABEL.get(boy_y, boy_y) if boy_y else None,
        "girl_value": YONI_LABEL.get(girl_y, girl_y) if girl_y else None,
    }


def calc_graha_maitri(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    score = _graha_maitri_score(boy_rashi, girl_rashi)
    return {
        "score": score, "max": 5, "compatible": score >= 3,
        "boy_value": RASHI_LORD.get(boy_rashi),
        "girl_value": RASHI_LORD.get(girl_rashi),
    }


def calc_gana(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    boy_gana = NAKSHATRA_GANA.get(boy_nak)
    girl_gana = NAKSHATRA_GANA.get(girl_nak)
    if boy_gana is None or girl_gana is None:
        return {"score": 0, "max": 6, "compatible": False,
                "boy_value": None, "girl_value": None}
    score = GANA_SCORE.get((boy_gana, girl_gana), 0)
    return {
        "score": score, "max": 6, "compatible": score >= 5,
        "boy_value": boy_gana, "girl_value": girl_gana,
    }


def calc_bhakoot(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    boy_idx = RASHI_INDEX.get(boy_rashi)
    girl_idx = RASHI_INDEX.get(girl_rashi)
    if boy_idx is None or girl_idx is None:
        return {"score": 0, "max": 7, "compatible": False,
                "boy_value": None, "girl_value": None, "axis": None}
    count = ((boy_idx - girl_idx) % 12) + 1
    count_rev = ((girl_idx - boy_idx) % 12) + 1
    axis = None
    if count in _BHAKOOT_INAUSPICIOUS or count_rev in _BHAKOOT_INAUSPICIOUS:
        used = count if count in _BHAKOOT_INAUSPICIOUS else count_rev
        axis_map = {2: "2-12", 12: "2-12", 5: "5-9", 9: "5-9", 6: "6-8", 8: "6-8"}
        axis = axis_map.get(used)
        return {
            "score": 0, "max": 7, "compatible": False,
            "boy_value": boy_rashi, "girl_value": girl_rashi, "axis": axis,
        }
    return {
        "score": 7, "max": 7, "compatible": True,
        "boy_value": boy_rashi, "girl_value": girl_rashi, "axis": None,
    }


def calc_nadi(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    boy_nadi = NAKSHATRA_NADI.get(boy_nak)
    girl_nadi = NAKSHATRA_NADI.get(girl_nak)
    if boy_nadi is None or girl_nadi is None:
        return {"score": 0, "max": 8, "compatible": False,
                "boy_value": None, "girl_value": None}
    compatible = boy_nadi != girl_nadi
    return {
        "score": 8 if compatible else 0, "max": 8, "compatible": compatible,
        "boy_value": NADI_LABEL.get(boy_nadi, boy_nadi),
        "girl_value": NADI_LABEL.get(girl_nadi, girl_nadi),
    }


# ---------------------------------------------------------------------------
# 6. DOSHA ANALYSIS
# ---------------------------------------------------------------------------

def analyse_manglik(boy: ManglikStatus, girl: ManglikStatus) -> dict[str, Any]:
    """
    Manglik (Mangal Dosha) analysis with intensity + cancellation.
      - YES = full Manglik
      - PARTIAL = Anshik Manglik (mild, often cancelled by age 28)
      - NO = no dosha
    Cancellation rules:
      - Both YES → cancelled (mutual)
      - Both PARTIAL → cancelled
      - One YES, other PARTIAL → reduced (low conflict)
      - One YES + other NO → conflict
      - One PARTIAL + other NO → minor conflict
    """
    valid: tuple[ManglikStatus, ...] = ("YES", "NO", "PARTIAL")
    if boy not in valid or girl not in valid:
        boy = "NO" if boy not in valid else boy
        girl = "NO" if girl not in valid else girl

    pair = frozenset({boy, girl}) if boy != girl else frozenset({boy})
    pair_t = (boy, girl)

    if boy == "NO" and girl == "NO":
        return {
            "boy_status": boy, "girl_status": girl,
            "conflict": False, "cancelled": False, "severity": "none",
            "reason": "Neither partner has Mangal Dosha.",
        }
    if boy == "YES" and girl == "YES":
        return {
            "boy_status": boy, "girl_status": girl,
            "conflict": False, "cancelled": True, "severity": "none",
            "reason": "Both partners are Manglik — Dosha is mutually cancelled.",
        }
    if pair == frozenset({"PARTIAL"}):
        return {
            "boy_status": boy, "girl_status": girl,
            "conflict": False, "cancelled": True, "severity": "none",
            "reason": "Both have Anshik (partial) Mangal Dosha — mutually neutralized.",
        }
    if pair_t in {("YES", "PARTIAL"), ("PARTIAL", "YES")}:
        return {
            "boy_status": boy, "girl_status": girl,
            "conflict": True, "cancelled": False, "severity": "low",
            "reason": "One full Manglik, one partial — significantly reduced impact.",
        }
    if pair_t in {("YES", "NO"), ("NO", "YES")}:
        return {
            "boy_status": boy, "girl_status": girl,
            "conflict": True, "cancelled": False, "severity": "high",
            "reason": "Only one partner is Manglik — full Mangal Dosha conflict.",
        }
    # PARTIAL + NO
    return {
        "boy_status": boy, "girl_status": girl,
        "conflict": True, "cancelled": False, "severity": "low",
        "reason": "Partial Manglik on one side — minor conflict, easily mitigated.",
    }


def analyse_nadi_dosha(boy_nak: str, girl_nak: str, boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """
    Nadi Dosha analysis with cancellation rules.
    Cancellations (parihara):
      - Same Rashi but different Nakshatra
      - Same Nakshatra but different Rashi (technically rare, possible at boundary)
      - One of the parties is born in pada/charan exception (we approximate without pada)
    """
    boy_nadi = NAKSHATRA_NADI.get(boy_nak)
    girl_nadi = NAKSHATRA_NADI.get(girl_nak)
    if not boy_nadi or not girl_nadi:
        return {
            "same_nadi": False, "dosha": False, "cancelled": False,
            "severity": "none", "reason": "Nakshatra missing — cannot evaluate.",
        }

    if boy_nadi != girl_nadi:
        return {
            "same_nadi": False, "dosha": False, "cancelled": False,
            "severity": "none", "boy_nadi": NADI_LABEL[boy_nadi], "girl_nadi": NADI_LABEL[girl_nadi],
            "reason": "Different Nadis — no Dosha. Health & progeny compatibility good.",
        }

    # Same nadi → dosha, check cancellation
    cancellations: list[str] = []
    if boy_rashi == girl_rashi and boy_nak != girl_nak:
        cancellations.append("Same Rashi with different Nakshatra (parihara).")
    if boy_nak == girl_nak and boy_rashi != girl_rashi:
        cancellations.append("Same Nakshatra spanning different Rashis (parihara).")

    cancelled = len(cancellations) > 0
    return {
        "same_nadi": True, "dosha": True, "cancelled": cancelled,
        "severity": "low" if cancelled else "high",
        "boy_nadi": NADI_LABEL[boy_nadi], "girl_nadi": NADI_LABEL[girl_nadi],
        "reason": (" ".join(cancellations) if cancelled
                   else "Both partners share the same Nadi — classical Dosha. "
                        "Indicates similar physiology; consult astrologer for parihara."),
    }


def analyse_bhakoot_dosha(boy_rashi: str, girl_rashi: str) -> dict[str, Any]:
    """
    Bhakoot Dosha analysis with cancellation rules.
    Cancellations:
      - Same Rashi lord (e.g., Mesha-Vrishchika both Mars)
      - Lords are mutual friends
      - Specific exceptional combinations
    """
    boy_idx = RASHI_INDEX.get(boy_rashi)
    girl_idx = RASHI_INDEX.get(girl_rashi)
    if boy_idx is None or girl_idx is None:
        return {"dosha": False, "cancelled": False, "severity": "none",
                "axis": None, "reason": "Rashi missing — cannot evaluate."}

    count = ((boy_idx - girl_idx) % 12) + 1
    count_rev = ((girl_idx - boy_idx) % 12) + 1
    axis = None
    if count in _BHAKOOT_INAUSPICIOUS or count_rev in _BHAKOOT_INAUSPICIOUS:
        used = count if count in _BHAKOOT_INAUSPICIOUS else count_rev
        axis_map = {2: "2-12 (Dwitiyadwadas)", 12: "2-12 (Dwitiyadwadas)",
                    5: "5-9 (Navam-Pancham)", 9: "5-9 (Navam-Pancham)",
                    6: "6-8 (Shadashtak)", 8: "6-8 (Shadashtak)"}
        axis = axis_map.get(used)

    if axis is None:
        return {"dosha": False, "cancelled": False, "severity": "none",
                "axis": None, "reason": "No Bhakoot Dosha — auspicious Rashi placement."}

    boy_lord = RASHI_LORD.get(boy_rashi)
    girl_lord = RASHI_LORD.get(girl_rashi)
    cancellations: list[str] = []
    if boy_lord and girl_lord:
        if boy_lord == girl_lord:
            cancellations.append(f"Both Rashi lords are {boy_lord} — Dosha cancelled.")
        else:
            rel_b = _planet_relation(boy_lord, girl_lord)
            rel_g = _planet_relation(girl_lord, boy_lord)
            if rel_b == "friend" and rel_g == "friend":
                cancellations.append(f"Rashi lords ({boy_lord} & {girl_lord}) are mutual friends — Dosha cancelled.")

    cancelled = len(cancellations) > 0
    return {
        "dosha": True, "cancelled": cancelled,
        "severity": "low" if cancelled else "high", "axis": axis,
        "reason": (" ".join(cancellations) if cancelled
                   else f"Bhakoot Dosha on the {axis} axis — affects family harmony & finance."),
    }


def analyse_rajju_dosha(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """Rajju Dosha — same Rajju (body limb) between bride+groom."""
    boy_r = NAKSHATRA_RAJJU.get(boy_nak)
    girl_r = NAKSHATRA_RAJJU.get(girl_nak)
    if not boy_r or not girl_r:
        return {"dosha": False, "boy_rajju": None, "girl_rajju": None,
                "severity": "none", "reason": "Nakshatra missing — cannot evaluate."}
    same = boy_r == girl_r
    return {
        "dosha": same,
        "boy_rajju": RAJJU_LABEL[boy_r], "girl_rajju": RAJJU_LABEL[girl_r],
        "severity": "high" if same else "none",
        "reason": (f"Both partners share {RAJJU_LABEL[boy_r]} — {RAJJU_SEVERITY[boy_r]}."
                   if same else "Different Rajju — no Dosha."),
    }


def analyse_vedha_dosha(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """Vedha Dosha — Nakshatra obstruction pair."""
    if not boy_nak or not girl_nak:
        return {"dosha": False, "severity": "none", "reason": "Nakshatra missing — cannot evaluate."}
    pair = frozenset({boy_nak, girl_nak})
    if pair in VEDHA_PAIR_SET:
        return {
            "dosha": True, "severity": "medium",
            "reason": f"{boy_nak} and {girl_nak} are an obstructive (Vedha) Nakshatra pair — "
                      f"may cause friction in matters of timing and luck.",
        }
    return {"dosha": False, "severity": "none", "reason": "No Vedha Dosha — Nakshatras do not obstruct each other."}


def analyse_gana_cancellation(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """
    Gana Dosha cancellation: even if Manav-Rakshasa or Dev-Rakshasa, dosha
    is cancelled when the Nakshatra Lords are friends or same, OR when the
    Rashi distance is auspicious (count 1-4 or 12-9 from each side).
    """
    boy_g = NAKSHATRA_GANA.get(boy_nak)
    girl_g = NAKSHATRA_GANA.get(girl_nak)
    if not boy_g or not girl_g:
        return {"dosha": False, "cancelled": False, "severity": "none",
                "reason": "Nakshatra missing — cannot evaluate."}
    score = GANA_SCORE.get((boy_g, girl_g), 0)
    if score >= 5:
        return {"dosha": False, "cancelled": False, "severity": "none",
                "boy_gana": boy_g, "girl_gana": girl_g,
                "reason": "No Gana Dosha — temperaments compatible."}

    severity = "high" if score == 0 else "medium"
    return {
        "dosha": True, "cancelled": False, "severity": severity,
        "boy_gana": boy_g, "girl_gana": girl_g,
        "reason": f"Gana mismatch: {boy_g} ↔ {girl_g}. May affect day-to-day temperament.",
    }


# ---------------------------------------------------------------------------
# 7. YOGAS — auspicious combinations
# ---------------------------------------------------------------------------

def analyse_mahendra_yoga(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """
    Mahendra Yoga — count from boy's Nakshatra to girl's. Counts of
    4, 7, 10, 13, 16, 19, 22, 25 are auspicious for progeny + longevity.
    """
    bi = NAKSHATRA_INDEX.get(boy_nak)
    gi = NAKSHATRA_INDEX.get(girl_nak)
    if bi is None or gi is None:
        return {"present": False, "count": None,
                "reason": "Nakshatra missing — cannot evaluate."}
    count = ((gi - bi) % 27) + 1
    present = count in _MAHENDRA_COUNTS
    return {
        "present": present, "count": count,
        "reason": ("Mahendra Yoga present — strong progeny prospects and long life."
                   if present else "Mahendra Yoga absent."),
    }


def analyse_stree_deergha(boy_nak: str, girl_nak: str) -> dict[str, Any]:
    """
    Stree Deergha — count from boy's Nakshatra to girl's should exceed 9.
    Indicates long married life and bride's well-being.
    """
    bi = NAKSHATRA_INDEX.get(boy_nak)
    gi = NAKSHATRA_INDEX.get(girl_nak)
    if bi is None or gi is None:
        return {"present": False, "count": None,
                "reason": "Nakshatra missing — cannot evaluate."}
    count = ((gi - bi) % 27) + 1
    present = count > 9
    return {
        "present": present, "count": count,
        "reason": ("Stree Deergha present — promises long, healthy married life for the bride."
                   if present else "Stree Deergha absent — count from groom's Nakshatra is ≤ 9."),
    }


# ---------------------------------------------------------------------------
# 8. LIFE-DOMAIN INSIGHTS — aggregate factors into 5 domains
# ---------------------------------------------------------------------------

def _domain_band(pct: float) -> tuple[str, str]:
    if pct >= 80:
        return "excellent", "Outstanding alignment in this area."
    if pct >= 60:
        return "good", "Healthy compatibility — minor adjustments only."
    if pct >= 40:
        return "average", "Mixed signals — open communication will help."
    return "low", "Notable friction — counsel & remedies advised."


def compute_insights(factors: dict[str, dict[str, Any]],
                     doshas: dict[str, dict[str, Any]],
                     yogas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """
    5 life-domain rollups. Each domain = weighted aggregate of factors+doshas.
    Output: { domain_key: { score: 0-100, label, summary } }
    """
    def _pct(score: int, m: int) -> float:
        return (score / m * 100) if m > 0 else 0.0

    # Mental Harmony — Gana + Graha Maitri + (no Vedha) + Yoni partial
    mental_score = (
        factors["gana"]["score"] / 6 * 50
        + factors["graha_maitri"]["score"] / 5 * 35
        + factors["yoni"]["score"] / 4 * 15
    )
    if doshas["vedha"]["dosha"]:
        mental_score *= 0.85

    # Physical / Health — Nadi + Yoni + (no Rajju)
    physical_score = (
        factors["nadi"]["score"] / 8 * 60
        + factors["yoni"]["score"] / 4 * 40
    )
    if doshas["rajju"]["dosha"]:
        physical_score *= 0.7
    if doshas["nadi"]["dosha"] and not doshas["nadi"]["cancelled"]:
        physical_score *= 0.85

    # Prosperity — Vashya + Bhakoot + Graha Maitri
    prosperity_score = (
        factors["vashya"]["score"] / 2 * 25
        + factors["bhakoot"]["score"] / 7 * 50
        + factors["graha_maitri"]["score"] / 5 * 25
    )
    if doshas["bhakoot"]["dosha"] and not doshas["bhakoot"]["cancelled"]:
        prosperity_score *= 0.8

    # Progeny / Family — Bhakoot + Mahendra Yoga + Nadi
    progeny_score = (
        factors["bhakoot"]["score"] / 7 * 50
        + factors["nadi"]["score"] / 8 * 35
        + (15 if yogas["mahendra"]["present"] else 0)
    )
    if doshas["nadi"]["dosha"] and not doshas["nadi"]["cancelled"]:
        progeny_score *= 0.7

    # Longevity & Destiny — Tara + Stree Deergha + Varna
    longevity_score = (
        factors["tara"]["score"] / 3 * 60
        + (25 if yogas["stree_deergha"]["present"] else 0)
        + factors["varna"]["score"] / 1 * 15
    )
    if doshas["manglik"]["conflict"] and not doshas["manglik"]["cancelled"]:
        if doshas["manglik"]["severity"] == "high":
            longevity_score *= 0.7
        elif doshas["manglik"]["severity"] == "low":
            longevity_score *= 0.9

    domains = {}
    for key, raw in [
        ("mental", mental_score),
        ("physical", physical_score),
        ("prosperity", prosperity_score),
        ("progeny", progeny_score),
        ("longevity", longevity_score),
    ]:
        pct = max(0.0, min(100.0, round(raw, 1)))
        label, summary = _domain_band(pct)
        domains[key] = {"score": pct, "label": label, "summary": summary}
    return domains


# ---------------------------------------------------------------------------
# 9. REMEDIES ENGINE
# ---------------------------------------------------------------------------

REMEDY_LIBRARY: dict[str, dict[str, str]] = {
    "manglik": {
        "name": "Mangal Shanti Puja",
        "description": "Recite Hanuman Chalisa daily, fast on Tuesdays, donate red lentils & jaggery, "
                       "perform Kumbh Vivah or Vishnu Vivah before marriage.",
    },
    "nadi": {
        "name": "Nadi Nivaran Puja",
        "description": "Perform Mahamrityunjaya Jaap (108 times), donate gold or cow, and consult an "
                       "astrologer for personalised parihara based on birth pada.",
    },
    "bhakoot": {
        "name": "Bhakoot Shanti",
        "description": "Recite the Navagraha Stotra, donate to a married couple's welfare, perform "
                       "Lakshmi Narayan Puja during the engagement.",
    },
    "rajju": {
        "name": "Rajju Dosha Parihara",
        "description": "Worship Lord Shiva and Parvati together, perform Rudrabhishek, recite "
                       "Maha-Mrityunjaya mantra; chant Stree Deergha mantras for the bride.",
    },
    "vedha": {
        "name": "Vedha Shanti",
        "description": "Light a ghee diya before Goddess Durga on Fridays, donate yellow grains, "
                       "recite Devi Suktam.",
    },
    "gana": {
        "name": "Gana Dosha Parihara",
        "description": "Recite Vishnu Sahasranama, perform Satyanarayan Vrat before marriage, "
                       "feed Brahmins on Thursdays.",
    },
}


def collect_remedies(doshas: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if doshas["manglik"]["conflict"] and not doshas["manglik"]["cancelled"]:
        r = REMEDY_LIBRARY["manglik"]
        out.append({"code": "manglik", "dosha": "Mangal Dosha",
                    "severity": doshas["manglik"]["severity"], **r})
    if doshas["nadi"]["dosha"] and not doshas["nadi"]["cancelled"]:
        r = REMEDY_LIBRARY["nadi"]
        out.append({"code": "nadi", "dosha": "Nadi Dosha",
                    "severity": doshas["nadi"]["severity"], **r})
    if doshas["bhakoot"]["dosha"] and not doshas["bhakoot"]["cancelled"]:
        r = REMEDY_LIBRARY["bhakoot"]
        out.append({"code": "bhakoot", "dosha": "Bhakoot Dosha",
                    "severity": doshas["bhakoot"]["severity"], **r})
    if doshas["rajju"]["dosha"]:
        r = REMEDY_LIBRARY["rajju"]
        out.append({"code": "rajju", "dosha": "Rajju Dosha",
                    "severity": doshas["rajju"]["severity"], **r})
    if doshas["vedha"]["dosha"]:
        r = REMEDY_LIBRARY["vedha"]
        out.append({"code": "vedha", "dosha": "Vedha Dosha",
                    "severity": doshas["vedha"]["severity"], **r})
    if doshas["gana"]["dosha"] and not doshas["gana"]["cancelled"]:
        r = REMEDY_LIBRARY["gana"]
        out.append({"code": "gana", "dosha": "Gana Dosha",
                    "severity": doshas["gana"]["severity"], **r})
    return out


# ---------------------------------------------------------------------------
# 10. INTERPRETATION
# ---------------------------------------------------------------------------

def _interpret(score: int, has_blocking_dosha: bool = False) -> tuple[str, str]:
    if score >= 32:
        label = "Excellent match"
        rec = ("Outstanding compatibility across all eight Ashtakoot factors. "
               "Auspicious for a long, prosperous, and harmonious married life.")
    elif score >= 25:
        label = "Good match"
        rec = ("Strong compatibility on most factors. Minor differences can be resolved "
               "with mutual respect and communication.")
    elif score >= 18:
        label = "Average match"
        rec = ("Moderate compatibility. Address weak factors with awareness — open "
               "communication and the suggested remedies will help.")
    else:
        label = "Not recommended"
        rec = ("Below classical threshold. Several core factors are weak. Strongly "
               "advised to consult a qualified astrologer before proceeding.")

    if has_blocking_dosha:
        rec += " Note: at least one significant Dosha is uncancelled — review the Doshas tab."
    return label, rec


def _normalize_manglik(value: Any) -> ManglikStatus:
    if isinstance(value, bool):
        return "YES" if value else "NO"
    if isinstance(value, str):
        v = value.upper()
        if v in ("YES", "NO", "PARTIAL"):
            return v  # type: ignore[return-value]
    return "NO"


# ---------------------------------------------------------------------------
# 11. MAIN CALCULATOR
# ---------------------------------------------------------------------------

class GunaMilanCalculator:
    """Advanced Ashtakoot Guna Milan calculator (North Indian system)."""

    def calculate(
        self,
        boy_rashi: str,
        boy_nak: str,
        girl_rashi: str,
        girl_nak: str,
        boy_manglik: bool | str,
        girl_manglik: bool | str,
    ) -> dict[str, Any]:
        boy_m = _normalize_manglik(boy_manglik)
        girl_m = _normalize_manglik(girl_manglik)

        # ----- 8 Ashtakoot factors -----
        factor_calcs = {
            "varna":        calc_varna(boy_rashi, girl_rashi),
            "vashya":       calc_vashya(boy_rashi, girl_rashi),
            "tara":         calc_tara(boy_nak, girl_nak),
            "yoni":         calc_yoni(boy_nak, girl_nak),
            "graha_maitri": calc_graha_maitri(boy_rashi, girl_rashi),
            "gana":         calc_gana(boy_nak, girl_nak),
            "bhakoot":      calc_bhakoot(boy_rashi, girl_rashi),
            "nadi":         calc_nadi(boy_nak, girl_nak),
        }

        # Enrich each factor with metadata + status
        factors: dict[str, dict[str, Any]] = {}
        for key, calc in factor_calcs.items():
            meta = FACTOR_META[key]
            status = _factor_status(calc["score"], calc["max"])
            factors[key] = {
                **calc,
                "name":     meta["name"],
                "name_hi":  meta["name_hi"],
                "domain":   meta["domain"],
                "meaning":  meta["meaning"],
                "status":   status,
            }

        total_score: int = sum(f["score"] for f in factors.values())
        max_score: int = 36
        percentage: float = round(total_score / max_score * 100, 2)

        # ----- Dosha analysis -----
        doshas = {
            "manglik": analyse_manglik(boy_m, girl_m),
            "nadi":    analyse_nadi_dosha(boy_nak, girl_nak, boy_rashi, girl_rashi),
            "bhakoot": analyse_bhakoot_dosha(boy_rashi, girl_rashi),
            "rajju":   analyse_rajju_dosha(boy_nak, girl_nak),
            "vedha":   analyse_vedha_dosha(boy_nak, girl_nak),
            "gana":    analyse_gana_cancellation(boy_nak, girl_nak),
        }

        # ----- Yogas -----
        yogas = {
            "mahendra":      analyse_mahendra_yoga(boy_nak, girl_nak),
            "stree_deergha": analyse_stree_deergha(boy_nak, girl_nak),
        }

        # ----- 5 Life-domain insights -----
        insights = compute_insights(factors, doshas, yogas)

        # ----- Remedies -----
        remedies = collect_remedies(doshas)

        # Blocking dosha = high-severity, uncancelled
        blocking = any(
            d.get("severity") == "high" and not d.get("cancelled", False)
            for d in doshas.values()
        )

        # ----- Interpretation -----
        interpretation, recommendation = _interpret(total_score, blocking)

        # Legacy field — preserved for backward compatibility
        mangal_dosha_conflict = doshas["manglik"]["conflict"] and not doshas["manglik"]["cancelled"]

        return {
            "total_score":           total_score,
            "max_score":             max_score,
            "percentage":            percentage,
            "factors":               factors,
            "doshas":                doshas,
            "yogas":                 yogas,
            "insights":              insights,
            "remedies":              remedies,
            "blocking_dosha":        blocking,
            "mangal_dosha_conflict": mangal_dosha_conflict,
            "interpretation":        interpretation,
            "recommendation":        recommendation,
        }


# Module-level singleton for import convenience
calculator = GunaMilanCalculator()
