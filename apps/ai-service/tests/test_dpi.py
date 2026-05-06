"""
DPI service tests — 13 tests covering all spec requirements.

Mocks:
  - src.services.dpi_service.predict  → controlled model output
  - src.services.dpi_service._get_anthropic / anthropic_client  → MagicMock
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.schemas.dpi import (
    DISCLAIMER,
    LEVEL_LABELS,
    DpiFeatures,
    DpiRequest,
)
from src.services.dpi_service import MOCK_NARRATIVES, compute_dpi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_LOW_FEATURES = DpiFeatures(
    age_gap_years=0.1,
    education_gap=0.1,
    income_disparity_pct=0.1,
    family_values_alignment=0.9,
    lifestyle_compatibility=0.8,
    communication_score=0.85,
    guna_milan_score=0.9,
    geographic_distance_km=0.1,
    religion_caste_match=0.9,
    preference_match_pct=0.85,
)

_BASE_REQUEST = DpiRequest(
    requesting_user_id="user-abc-123",
    match_id="match-xyz-456",
    features=_LOW_FEATURES,
    profile_a_summary="Software engineer who loves music and travel",
    profile_b_summary="Teacher who enjoys cooking and reading",
    shared_strengths=["family values", "stability"],
)


def _make_predict_result(
    score: float,
    level: str,
    factor_contributions: dict[str, float] | None = None,
    top_3: list[str] | None = None,
) -> dict:
    fc = factor_contributions or {
        "age_gap_years": -0.1,
        "education_gap": -0.05,
        "income_disparity_pct": 0.03,
        "family_values_alignment": -0.2,
        "lifestyle_compatibility": -0.15,
        "communication_score": 0.1,
        "guna_milan_score": 0.08,
        "geographic_distance_km": 0.02,
        "religion_caste_match": -0.12,
        "preference_match_pct": 0.06,
    }
    t3 = top_3 or sorted(fc, key=lambda k: abs(fc[k]), reverse=True)[:3]
    return {
        "score": score,
        "level": level,
        "factor_contributions": fc,
        "top_3_factors": t3,
    }


def _make_anthropic_response(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_compute_dpi_low_risk_returns_strong_foundation_label():
    """Test 1: LOW level → 'Strong Foundation' label."""
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.15, "LOW")):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=None, use_mock=True)
    assert result.level == "LOW"
    assert result.label == "Strong Foundation"


@pytest.mark.asyncio
async def test_compute_dpi_medium_risk_returns_areas_to_discuss():
    """Test 2: MEDIUM level → 'Some Areas to Discuss' label."""
    req = _BASE_REQUEST.model_copy()
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.42, "MEDIUM")):
        result = await compute_dpi(req, anthropic_client=None, use_mock=True)
    assert result.level == "MEDIUM"
    assert result.label == "Some Areas to Discuss"


@pytest.mark.asyncio
async def test_compute_dpi_high_risk_returns_important_conversations():
    """Test 3: HIGH level → 'Important Conversations Needed' label."""
    req = _BASE_REQUEST.model_copy()
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.75, "HIGH")):
        result = await compute_dpi(req, anthropic_client=None, use_mock=True)
    assert result.level == "HIGH"
    assert result.label == "Important Conversations Needed"


@pytest.mark.asyncio
async def test_disclaimer_always_included():
    """Test 4: disclaimer field always populated."""
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.15, "LOW")):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=None, use_mock=True)
    assert result.disclaimer == DISCLAIMER
    assert len(result.disclaimer) > 0


@pytest.mark.asyncio
async def test_top_factors_max_3_returned():
    """Test 5: top_factors list never exceeds 3 items."""
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.15, "LOW")):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=None, use_mock=True)
    assert len(result.top_factors) <= 3


@pytest.mark.asyncio
async def test_factor_direction_protective_for_low_feature_value():
    """Test 6: top factor with input feature_value < 0.30 → 'protective'.

    Contribution sign is intentionally positive here — the classifier must
    look at the input feature value, not the contribution.
    """
    req = _BASE_REQUEST.model_copy(
        update={
            "features": _BASE_REQUEST.features.model_copy(
                update={"age_gap_years": 0.10}
            )
        }
    )
    fc = {name: 0.0 for name in _LOW_FEATURES.model_dump()}
    fc["age_gap_years"] = 0.20  # positive contribution — irrelevant under new rule
    model_result = _make_predict_result(0.15, "LOW", fc, ["age_gap_years"])
    with patch("src.services.dpi_service.predict", return_value=model_result):
        result = await compute_dpi(req, anthropic_client=None, use_mock=True)
    factor = next(f for f in result.top_factors if f.factor == "age_gap_years")
    assert factor.direction == "protective"


@pytest.mark.asyncio
async def test_factor_direction_concern_for_high_feature_value():
    """Test 7: top factor with input feature_value > 0.55 → 'concern'."""
    req = _BASE_REQUEST.model_copy(
        update={
            "features": _BASE_REQUEST.features.model_copy(
                update={"communication_score": 0.90}
            )
        }
    )
    fc = {name: 0.0 for name in _LOW_FEATURES.model_dump()}
    fc["communication_score"] = 0.30
    model_result = _make_predict_result(0.60, "HIGH", fc, ["communication_score"])
    with patch("src.services.dpi_service.predict", return_value=model_result):
        result = await compute_dpi(req, anthropic_client=None, use_mock=True)
    factor = next(f for f in result.top_factors if f.factor == "communication_score")
    assert factor.direction == "concern"


@pytest.mark.asyncio
async def test_factor_direction_neutral_for_midband_feature_value():
    """Boundary pin: feature_value in [0.30, 0.55] → 'neutral'."""
    req = _BASE_REQUEST.model_copy(
        update={
            "features": _BASE_REQUEST.features.model_copy(
                update={"income_disparity_pct": 0.45}
            )
        }
    )
    fc = {name: 0.0 for name in _LOW_FEATURES.model_dump()}
    fc["income_disparity_pct"] = 0.10
    model_result = _make_predict_result(0.40, "MEDIUM", fc, ["income_disparity_pct"])
    with patch("src.services.dpi_service.predict", return_value=model_result):
        result = await compute_dpi(req, anthropic_client=None, use_mock=True)
    factor = next(f for f in result.top_factors if f.factor == "income_disparity_pct")
    assert factor.direction == "neutral"


@pytest.mark.asyncio
async def test_mock_mode_skips_llm_returns_canned_narrative():
    """Test 8: use_mock=True returns MOCK_NARRATIVES narrative, never calls LLM."""
    mock_anthropic = MagicMock()
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.15, "LOW")):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=mock_anthropic, use_mock=True)
    # LLM was never called
    mock_anthropic.messages.create.assert_not_called()
    assert result.narrative == MOCK_NARRATIVES["LOW"]["narrative"]
    assert result.suggestion == MOCK_NARRATIVES["LOW"]["suggestion"]


@pytest.mark.asyncio
async def test_llm_exception_falls_back_to_mock_narrative_silently():
    """Test 9: LLM RuntimeError → silent fallback to MOCK_NARRATIVES, no exception raised."""
    mock_anthropic = MagicMock()
    mock_anthropic.messages.create.side_effect = RuntimeError("Network error")

    # Use a real prompt path by patching Path.read_text
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.42, "MEDIUM")), \
         patch("pathlib.Path.read_text", return_value="# system prompt"):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=mock_anthropic, use_mock=False)

    assert result.narrative == MOCK_NARRATIVES["MEDIUM"]["narrative"]
    assert result.suggestion == MOCK_NARRATIVES["MEDIUM"]["suggestion"]
    assert result.level == "MEDIUM"


@pytest.mark.asyncio
async def test_xml_parsing_handles_malformed_response_gracefully():
    """Test 10: malformed XML → falls back to mock narrative without raising."""
    mock_anthropic = MagicMock()
    mock_anthropic.messages.create.return_value = _make_anthropic_response(
        "This is a totally malformed response with no XML tags at all."
    )
    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.75, "HIGH")), \
         patch("pathlib.Path.read_text", return_value="# system prompt"):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=mock_anthropic, use_mock=False)
    # Falls back to mock when XML parsing fails
    assert result.narrative == MOCK_NARRATIVES["HIGH"]["narrative"]
    assert result.suggestion == MOCK_NARRATIVES["HIGH"]["suggestion"]


@pytest.mark.asyncio
async def test_score_clamped_to_0_1_range():
    """Test 11: model score outside [0,1] is clamped before returning."""
    # Inject a score slightly above 1.0 (edge case from floating point)
    model_result = _make_predict_result(1.0000001, "HIGH")
    model_result["score"] = 1.0000001
    with patch("src.services.dpi_service.predict", return_value=model_result):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=None, use_mock=True)
    assert 0.0 <= result.score <= 1.0


@pytest.mark.asyncio
async def test_label_matches_level_via_level_labels_dict():
    """Test 12: label matches LEVEL_LABELS[level] for all three levels."""
    for level, expected_label in LEVEL_LABELS.items():
        score = {"LOW": 0.15, "MEDIUM": 0.42, "HIGH": 0.75}[level]
        with patch(
            "src.services.dpi_service.predict",
            return_value=_make_predict_result(score, level),
        ):
            result = await compute_dpi(_BASE_REQUEST, anthropic_client=None, use_mock=True)
        assert result.label == expected_label, f"Expected {expected_label!r} for {level}, got {result.label!r}"


@pytest.mark.asyncio
async def test_forbidden_word_triggers_fallback_to_mock():
    """Test 13: LLM emitting forbidden word 'fail' → response uses MOCK_NARRATIVES."""
    bad_xml = (
        "<narrative>This match is likely to fail due to value misalignment.</narrative>"
        "<suggestion>Reconsider this match carefully.</suggestion>"
    )
    mock_anthropic = MagicMock()
    mock_anthropic.messages.create.return_value = _make_anthropic_response(bad_xml)

    with patch("src.services.dpi_service.predict", return_value=_make_predict_result(0.75, "HIGH")), \
         patch("pathlib.Path.read_text", return_value="# system prompt"):
        result = await compute_dpi(_BASE_REQUEST, anthropic_client=mock_anthropic, use_mock=False)

    # Forbidden word "fail" should have triggered fallback
    assert result.narrative == MOCK_NARRATIVES["HIGH"]["narrative"]
    assert result.suggestion == MOCK_NARRATIVES["HIGH"]["suggestion"]
    # The forbidden word must NOT appear in the final output
    assert "fail" not in result.narrative.lower()
