"""
FII (Family Inclination Index) service.

Responsibilities:
  - compute_individual_score: weighted sum of 7 signals → 0-100 score + label
  - compatibility_label: delta → (label, hex color)
  - TEMPLATES: 15 frozenset-keyed templates (all 5×5 unordered pairs)
  - compute_compatibility: orchestrates both scores + template/Sonnet narrative

Module-load assertions:
  - WEIGHTS sum ≈ 1.0
  - All 15 template keys present
  - No template narrative/discussion_starter contains a forbidden word
"""

from __future__ import annotations

import re
from pathlib import Path

import structlog

from src.schemas.fii import (
    FiiCompatibilityRequest,
    FiiCompatibilityResponse,
    FiiProfileScore,
    FiiSignals,
)
from src.services.llm_client import get_llm_client

log = structlog.get_logger("fii_service")

# ---------------------------------------------------------------------------
# Weights — must sum to 1.0 (±0.01 tolerance)
# ---------------------------------------------------------------------------

WEIGHTS: dict[str, float] = {
    "family_type_preference": 0.20,
    "family_values_orientation": 0.15,
    "parents_living_intent": 0.18,
    "family_decisions": 0.15,
    "cultural_events": 0.12,
    "siblings_engagement": 0.07,
    "religious_practice": 0.13,
}

assert abs(sum(WEIGHTS.values()) - 1.0) < 0.01, (
    f"FII WEIGHTS do not sum to 1.0: {sum(WEIGHTS.values())}"
)

# ---------------------------------------------------------------------------
# Forbidden words — checked on every LLM output before returning
# ---------------------------------------------------------------------------

FORBIDDEN_WORDS: list[str] = [
    "incompatible",
    "wrong",
    "fail",
    "doomed",
    "should",
    "must",
]

# ---------------------------------------------------------------------------
# Color map
# ---------------------------------------------------------------------------

COLOR_MAP: dict[str, str] = {
    "Highly Aligned": "#7FA682",
    "Mostly Aligned": "#C5A47E",
    "Worth Discussing": "#0E7C7B",
    "Different Outlooks": "#6B6B76",
}

# ---------------------------------------------------------------------------
# 15 Templates  (frozenset keys so (A,B) == (B,A))
# ---------------------------------------------------------------------------

_T = frozenset  # shorthand


TEMPLATES: dict[frozenset, dict[str, str]] = {
    # ── Same-label pairs (5) ─────────────────────────────────────────────────
    _T(["Family-First", "Family-First"]): {
        "narrative": (
            "You both place family at the heart of your lives. "
            "This shared foundation often eases major decisions and builds deep mutual support."
        ),
        "discussion_starter": (
            "Talk about how you each picture an ideal family gathering or tradition "
            "you would want to continue."
        ),
    },
    _T(["Family-Oriented", "Family-Oriented"]): {
        "narrative": (
            "Family holds a strong and central place for both of you. "
            "You are likely to find it easy to align on priorities like proximity to parents "
            "and involvement in family milestones."
        ),
        "discussion_starter": (
            "Discuss how you each envision balancing family commitments with the couple's "
            "own personal time and space."
        ),
    },
    _T(["Balanced", "Balanced"]): {
        "narrative": (
            "You both occupy a thoughtful middle ground — valuing family bonds while "
            "also honouring personal space and independence. "
            "This symmetry often makes day-to-day negotiation intuitive."
        ),
        "discussion_starter": (
            "Explore what 'balance' means to each of you specifically — for instance, "
            "how often you'd like to visit or host extended family."
        ),
    },
    _T(["Independent-Leaning", "Independent-Leaning"]): {
        "narrative": (
            "You both lean toward personal autonomy in how you structure your lives. "
            "This shared orientation can create a great sense of freedom and partnership."
        ),
        "discussion_starter": (
            "Talk about how you each imagine staying connected with your families of origin "
            "while building your own household rhythms."
        ),
    },
    _T(["Independent", "Independent"]): {
        "narrative": (
            "You both have a strongly self-directed approach to life, "
            "with family playing a quieter background role. "
            "This alignment opens up a lot of freedom to define your partnership on your own terms."
        ),
        "discussion_starter": (
            "It is worth discussing how you each envision the role of parents and siblings "
            "during important life events like festivals, health situations, and milestones."
        ),
    },
    # ── Cross-label pairs (10) ───────────────────────────────────────────────
    _T(["Family-First", "Family-Oriented"]): {
        "narrative": (
            "One of you is deeply family-centred while the other holds family as a strong "
            "but not all-encompassing priority — a small difference that often resolves naturally "
            "as you learn each other's rhythms."
        ),
        "discussion_starter": (
            "Talk about how you each picture the role of parents in major household decisions "
            "like finances, living arrangements, and festivals."
        ),
    },
    _T(["Family-First", "Balanced"]): {
        "narrative": (
            "You come from somewhat different orientations — one deeply rooted in family life, "
            "the other navigating a balance between connection and independence. "
            "Many couples bridge this difference with curiosity and patience."
        ),
        "discussion_starter": (
            "A useful conversation would be around where you each picture living relative "
            "to your parents, and how involved they would be in daily life."
        ),
    },
    _T(["Family-First", "Independent-Leaning"]): {
        "narrative": (
            "There is a meaningful difference in how centrally family figures into each of "
            "your lives — one partner is deeply family-oriented while the other values "
            "personal space and autonomy. "
            "These are two valid paths, and this difference is worth exploring openly."
        ),
        "discussion_starter": (
            "Discuss how you each imagine the first few years of marriage — particularly "
            "around proximity to parents, living arrangements, and involvement in extended "
            "family decisions."
        ),
    },
    _T(["Family-First", "Independent"]): {
        "narrative": (
            "You appear to be walking quite different paths when it comes to family life — "
            "one partner places family at the very centre while the other values a more "
            "self-directed existence. "
            "Both are meaningful ways of living, and open conversation can help you understand "
            "each other's worlds."
        ),
        "discussion_starter": (
            "It would be worth exploring each person's expectations around joint family living, "
            "financial interdependence with parents, and involvement in family rituals."
        ),
    },
    _T(["Family-Oriented", "Balanced"]): {
        "narrative": (
            "One of you holds family as a central priority while the other navigates a "
            "thoughtful balance between personal space and family bonds — "
            "a difference that is common and workable when both partners understand each "
            "other's rhythms."
        ),
        "discussion_starter": (
            "Explore how you each imagine the role of extended family in your day-to-day "
            "life after marriage — proximity, visits, shared decisions."
        ),
    },
    _T(["Family-Oriented", "Independent-Leaning"]): {
        "narrative": (
            "There is a noticeable gap in how much family structures your daily life — "
            "one partner centres it, while the other tends toward personal independence. "
            "This is a worthwhile area to explore together."
        ),
        "discussion_starter": (
            "Talk about how you each picture the frequency and depth of engagement with "
            "parents and siblings once you are settled together."
        ),
    },
    _T(["Family-Oriented", "Independent"]): {
        "narrative": (
            "You hold quite different orientations — one of you finds deep meaning in "
            "family connection, while the other gravitates toward personal autonomy. "
            "Understanding the 'why' behind each perspective can open up rich conversation."
        ),
        "discussion_starter": (
            "Discuss what family involvement looks like to each of you during key moments "
            "like festivals, major purchases, and health decisions."
        ),
    },
    _T(["Balanced", "Independent-Leaning"]): {
        "narrative": (
            "You sit fairly close on the spectrum — one of you balances family and "
            "independence, and the other leans a bit more toward personal space. "
            "This proximity often means your expectations naturally converge over time."
        ),
        "discussion_starter": (
            "Talk about how you each imagine structuring your week — how much time "
            "with family versus just the two of you."
        ),
    },
    _T(["Balanced", "Independent"]): {
        "narrative": (
            "One of you occupies a thoughtful middle ground on family involvement, "
            "while the other is more strongly drawn to personal independence. "
            "The gap is manageable with honest conversation about boundaries and expectations."
        ),
        "discussion_starter": (
            "A helpful discussion would be around what 'family obligations' look and "
            "feel like to each of you — time, finances, living decisions."
        ),
    },
    _T(["Independent-Leaning", "Independent"]): {
        "narrative": (
            "You both lean toward personal autonomy, with one of you slightly more "
            "open to family involvement. "
            "This shared direction means you are likely to find alignment on how to structure "
            "your household life."
        ),
        "discussion_starter": (
            "Discuss how each of you envisions staying connected with your families of "
            "origin as you build your own home together."
        ),
    },
}

# Default fallback for any unmapped pair (should not occur once all 15 are confirmed)
_DEFAULT_TEMPLATE: dict[str, str] = {
    "narrative": (
        "Your family inclination profiles offer an interesting starting point for "
        "understanding each other's approach to relationships and home life."
    ),
    "discussion_starter": (
        "Talk openly about what 'family' means to each of you and how you imagine "
        "it fitting into your shared future."
    ),
}

# ---------------------------------------------------------------------------
# Module-load validation — assert all 15 keys present + no forbidden words
# ---------------------------------------------------------------------------

_EXPECTED_LABEL_PAIRS: list[frozenset] = [
    _T([a, b])
    for i, a in enumerate(
        ["Family-First", "Family-Oriented", "Balanced", "Independent-Leaning", "Independent"]
    )
    for b in ["Family-First", "Family-Oriented", "Balanced", "Independent-Leaning", "Independent"][
        i:
    ]
]
assert len(_EXPECTED_LABEL_PAIRS) == 15, "Expected 15 label pairs"

_missing = [k for k in _EXPECTED_LABEL_PAIRS if k not in TEMPLATES]
assert not _missing, f"Missing template keys: {_missing}"

for _key, _tmpl in TEMPLATES.items():
    for _field in ("narrative", "discussion_starter"):
        _text = _tmpl[_field].lower()
        for _word in FORBIDDEN_WORDS:
            assert _word not in _text, (
                f"Forbidden word '{_word}' found in template for {_key!r} field '{_field}'"
            )


# ---------------------------------------------------------------------------
# Core scoring functions
# ---------------------------------------------------------------------------


def label_for_score(score: int) -> str:
    """Map 0-100 score to one of the 5 FII label bands."""
    if score >= 80:
        return "Family-First"
    if score >= 60:
        return "Family-Oriented"
    if score >= 40:
        return "Balanced"
    if score >= 20:
        return "Independent-Leaning"
    return "Independent"


def compute_individual_score(signals: FiiSignals) -> FiiProfileScore:
    """Weighted average of 7 signals → FiiProfileScore."""
    raw = sum(getattr(signals, k) * w for k, w in WEIGHTS.items())
    score = max(0, min(100, round(raw)))
    label = label_for_score(score)
    breakdown = {k: round(getattr(signals, k) * w) for k, w in WEIGHTS.items()}
    return FiiProfileScore(score=score, label=label, breakdown=breakdown)


def get_compatibility_label(delta: int) -> tuple[str, str]:
    """Map delta (0-100) to a (compatibility_label, hex_color) tuple."""
    if delta <= 15:
        label = "Highly Aligned"
    elif delta <= 30:
        label = "Mostly Aligned"
    elif delta <= 50:
        label = "Worth Discussing"
    else:
        label = "Different Outlooks"
    return label, COLOR_MAP[label]


def _get_template(label_a: str, label_b: str) -> dict[str, str]:
    """Look up template by frozenset of labels, fall back to default."""
    key = frozenset([label_a, label_b])
    return TEMPLATES.get(key, _DEFAULT_TEMPLATE)


def _contains_forbidden_word(text: str) -> bool:
    """Return True if any forbidden word appears as a substring (case-insensitive)."""
    lower = text.lower()
    return any(word in lower for word in FORBIDDEN_WORDS)


def _parse_xml_field(text: str, tag: str) -> str | None:
    """Extract content between <tag>…</tag>. Returns None if not found."""
    pattern = rf"<{tag}>(.*?)</{tag}>"
    match = re.search(pattern, text, re.DOTALL)
    return match.group(1).strip() if match else None


def _load_system_prompt() -> str:
    """Load fii-narrative-v1.md system prompt from prompts directory."""
    prompt_path = (
        Path(__file__).parent.parent.parent.parent.parent
        / "prompts"
        / "fii-narrative-v1.md"
    )
    try:
        return prompt_path.read_text(encoding="utf-8")
    except Exception:  # noqa: BLE001
        return "You are a warm, observational relationship compatibility advisor."


# ---------------------------------------------------------------------------
# Lazy Anthropic client (sync, same pattern as dpi_service)
# ---------------------------------------------------------------------------

_anthropic_client = None


def _get_anthropic():
    global _anthropic_client  # noqa: PLW0603
    if _anthropic_client is not None:
        return _anthropic_client
    # Provider chosen by LLM_PROVIDER env (anthropic default | gemini).
    _anthropic_client = get_llm_client(is_async=False)
    return _anthropic_client


# ---------------------------------------------------------------------------
# Main compatibility computation
# ---------------------------------------------------------------------------


async def compute_compatibility(
    request: FiiCompatibilityRequest,
    anthropic_client=None,
    use_mock: bool = True,
) -> FiiCompatibilityResponse:
    """
    Compute FII compatibility for a profile pair.

    Pipeline:
      1. Score each profile via compute_individual_score.
      2. Compute delta and compatibility label.
      3. If use_llm_narrative=True AND not use_mock AND anthropic_client available:
           → call Sonnet 4.6, parse XML, validate no forbidden words.
           → on ANY exception or forbidden-word hit → fall back to template silently.
      4. Otherwise: use template directly.
    """
    score_a = compute_individual_score(request.profile_a)
    score_b = compute_individual_score(request.profile_b)
    delta = abs(score_a.score - score_b.score)
    compat_label, compat_color = get_compatibility_label(delta)

    # Template baseline (always computed; used as fallback)
    tmpl = _get_template(score_a.label, score_b.label)
    narrative_text = tmpl["narrative"]
    discussion_text = tmpl["discussion_starter"]
    narrative_source: str = "template"

    # LLM path — only when explicitly requested and live mode
    if request.use_llm_narrative and not use_mock:
        client = anthropic_client or _get_anthropic()
        if client is not None:
            try:
                system_prompt = _load_system_prompt()
                name_a = request.profile_a_name or "Profile A"
                name_b = request.profile_b_name or "Profile B"
                user_message = (
                    f"Profile A ({name_a}): {score_a.label} (score {score_a.score}/100)\n"
                    f"Profile B ({name_b}): {score_b.label} (score {score_b.score}/100)\n"
                    f"Delta: {delta} — Compatibility: {compat_label}\n\n"
                    "Generate the narrative and discussion_starter XML."
                )
                response = client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=512,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                )
                raw_text = response.content[0].text

                parsed_narrative = _parse_xml_field(raw_text, "narrative")
                parsed_discussion = _parse_xml_field(raw_text, "discussion_starter")

                if parsed_narrative and parsed_discussion:
                    # Forbidden-word validation on both fields
                    combined = parsed_narrative + " " + parsed_discussion
                    if not _contains_forbidden_word(combined):
                        narrative_text = parsed_narrative
                        discussion_text = parsed_discussion
                        narrative_source = "sonnet"
                    else:
                        log.warning(
                            "fii_llm_forbidden_word_fallback",
                            label_a=score_a.label,
                            label_b=score_b.label,
                        )
                else:
                    log.warning(
                        "fii_llm_xml_parse_failed",
                        label_a=score_a.label,
                        label_b=score_b.label,
                    )
            except Exception as exc:  # noqa: BLE001
                log.warning("fii_llm_exception_fallback", error=str(exc))

    return FiiCompatibilityResponse(
        profile_a_score=score_a,
        profile_b_score=score_b,
        delta=delta,
        compatibility=compat_label,
        compatibility_color=compat_color,
        narrative=narrative_text,
        discussion_starter=discussion_text,
        narrative_source=narrative_source,  # type: ignore[arg-type]
    )
