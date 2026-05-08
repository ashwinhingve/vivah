"""
FII service tests — 12 tests covering all spec requirements.

Mocks:
  - anthropic_client passed directly as MagicMock / AsyncMock
  - pathlib.Path.read_text for prompt loading
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.schemas.fii import FiiCompatibilityRequest, FiiSignals
from src.services.fii_service import (
    FORBIDDEN_WORDS,
    TEMPLATES,
    WEIGHTS,
    _get_template,
    compute_compatibility,
    compute_individual_score,
    get_compatibility_label,
    label_for_score,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALL_MAX = FiiSignals(
    family_type_preference=100,
    family_values_orientation=100,
    parents_living_intent=100,
    family_decisions=100,
    cultural_events=100,
    siblings_engagement=100,
    religious_practice=100,
)

_ALL_MIN = FiiSignals(
    family_type_preference=0,
    family_values_orientation=0,
    parents_living_intent=0,
    family_decisions=0,
    cultural_events=0,
    siblings_engagement=0,
    religious_practice=0,
)

_MID = FiiSignals(
    family_type_preference=50,
    family_values_orientation=50,
    parents_living_intent=50,
    family_decisions=50,
    cultural_events=50,
    siblings_engagement=50,
    religious_practice=50,
)


def _make_request(
    a: FiiSignals = _ALL_MAX,
    b: FiiSignals = _ALL_MAX,
    use_llm: bool = False,
) -> FiiCompatibilityRequest:
    return FiiCompatibilityRequest(
        profile_a=a,
        profile_b=b,
        profile_a_name="Priya",
        profile_b_name="Arjun",
        use_llm_narrative=use_llm,
    )


def _make_anthropic_response(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


# ---------------------------------------------------------------------------
# Test 1 — all-max signals → Family-First label
# ---------------------------------------------------------------------------

def test_compute_individual_score_all_max_returns_family_first_label():
    result = compute_individual_score(_ALL_MAX)
    assert result.score == 100
    assert result.label == "Family-First"


# ---------------------------------------------------------------------------
# Test 2 — all-min signals → Independent label
# ---------------------------------------------------------------------------

def test_compute_individual_score_all_min_returns_independent_label():
    result = compute_individual_score(_ALL_MIN)
    assert result.score == 0
    assert result.label == "Independent"


# ---------------------------------------------------------------------------
# Test 3 — label band boundaries
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score,expected_label", [
    (0, "Independent"),
    (19, "Independent"),
    (20, "Independent-Leaning"),
    (39, "Independent-Leaning"),
    (40, "Balanced"),
    (59, "Balanced"),
    (60, "Family-Oriented"),
    (79, "Family-Oriented"),
    (80, "Family-First"),
    (100, "Family-First"),
])
def test_label_band_boundaries(score: int, expected_label: str):
    assert label_for_score(score) == expected_label


# ---------------------------------------------------------------------------
# Test 4 — compatibility label band boundaries
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("delta,expected_label", [
    (0, "Highly Aligned"),
    (15, "Highly Aligned"),
    (16, "Mostly Aligned"),
    (30, "Mostly Aligned"),
    (31, "Worth Discussing"),
    (50, "Worth Discussing"),
    (51, "Different Outlooks"),
    (100, "Different Outlooks"),
])
def test_compatibility_label_band_boundaries(delta: int, expected_label: str):
    label, color = get_compatibility_label(delta)
    assert label == expected_label
    assert color.startswith("#")


# ---------------------------------------------------------------------------
# Test 5 — template lookup is order-independent (frozenset)
# ---------------------------------------------------------------------------

def test_template_lookup_order_independent():
    tmpl_ab = _get_template("Family-First", "Independent")
    tmpl_ba = _get_template("Independent", "Family-First")
    assert tmpl_ab == tmpl_ba
    assert tmpl_ab is not None
    assert "narrative" in tmpl_ab
    assert "discussion_starter" in tmpl_ab


# ---------------------------------------------------------------------------
# Test 6 — compute_compatibility returns full response shape
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_compute_compatibility_returns_full_shape():
    req = _make_request(_ALL_MAX, _ALL_MAX)
    result = await compute_compatibility(req, anthropic_client=None, use_mock=True)

    assert 0 <= result.profile_a_score.score <= 100
    assert 0 <= result.profile_b_score.score <= 100
    assert result.delta >= 0
    assert result.compatibility in ["Highly Aligned", "Mostly Aligned", "Worth Discussing", "Different Outlooks"]
    assert result.compatibility_color.startswith("#")
    assert len(result.narrative) > 10
    assert len(result.discussion_starter) > 10
    assert result.narrative_source in ("template", "sonnet")


# ---------------------------------------------------------------------------
# Test 7 — use_llm_narrative=False always returns template source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_use_llm_narrative_false_returns_template_source():
    req = _make_request(_ALL_MAX, _MID, use_llm=False)
    mock_client = MagicMock()
    result = await compute_compatibility(req, anthropic_client=mock_client, use_mock=False)

    # LLM must NOT be called when use_llm_narrative=False
    mock_client.messages.create.assert_not_called()
    assert result.narrative_source == "template"


# ---------------------------------------------------------------------------
# Test 8 — use_llm_narrative=True with use_mock=True → still template source
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_use_llm_narrative_true_with_mock_returns_template_source():
    req = _make_request(_ALL_MAX, _MID, use_llm=True)
    mock_client = MagicMock()
    result = await compute_compatibility(req, anthropic_client=mock_client, use_mock=True)

    # LLM must NOT be called in mock mode even when use_llm_narrative=True
    mock_client.messages.create.assert_not_called()
    assert result.narrative_source == "template"


# ---------------------------------------------------------------------------
# Test 9 — LLM raises exception → silently returns template
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_llm_failure_falls_back_to_template_silently():
    req = _make_request(_ALL_MAX, _MID, use_llm=True)
    mock_client = MagicMock()
    mock_client.messages.create.side_effect = RuntimeError("Network timeout")

    with patch("pathlib.Path.read_text", return_value="# system prompt"):
        result = await compute_compatibility(req, anthropic_client=mock_client, use_mock=False)

    assert result.narrative_source == "template"
    assert len(result.narrative) > 10


# ---------------------------------------------------------------------------
# Test 10 — breakdown sums to score within tolerance ±2
# ---------------------------------------------------------------------------

def test_breakdown_sums_to_score_within_tolerance():
    for signals in [_ALL_MAX, _ALL_MIN, _MID]:
        result = compute_individual_score(signals)
        breakdown_sum = sum(result.breakdown.values())
        assert abs(breakdown_sum - result.score) <= 2, (
            f"breakdown_sum={breakdown_sum} vs score={result.score} for signals={signals}"
        )


# ---------------------------------------------------------------------------
# Test 11 — no forbidden words in any template narrative or discussion_starter
# ---------------------------------------------------------------------------

def test_no_forbidden_words_in_template_narratives():
    for key, tmpl in TEMPLATES.items():
        for field in ("narrative", "discussion_starter"):
            text = tmpl[field].lower()
            for word in FORBIDDEN_WORDS:
                assert word not in text, (
                    f"Forbidden word '{word}' found in template key={key!r} field='{field}'"
                )


# ---------------------------------------------------------------------------
# Test 12 — LLM output containing forbidden word → falls back to template
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_forbidden_word_in_llm_output_falls_back_to_template():
    bad_xml = (
        "<narrative>You should reconsider this match entirely.</narrative>"
        "<discussion_starter>Discuss your differences openly.</discussion_starter>"
    )
    mock_client = MagicMock()
    mock_client.messages.create.return_value = _make_anthropic_response(bad_xml)

    req = _make_request(_ALL_MAX, _ALL_MIN, use_llm=True)
    with patch("pathlib.Path.read_text", return_value="# system prompt"):
        result = await compute_compatibility(req, anthropic_client=mock_client, use_mock=False)

    assert result.narrative_source == "template"
    # The forbidden word must NOT be in the returned narrative
    assert "should" not in result.narrative.lower()
