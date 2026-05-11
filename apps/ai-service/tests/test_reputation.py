"""
Reputation Score service + endpoint tests.

The classifier itself is exercised in test_reputation_model.py with real
training. These tests mock src.services.reputation_service.predict for
deterministic level/tier coverage and exercise the FastAPI route.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.schemas.reputation import (
    DISCLAIMER,
    ReputationFeatures,
    ReputationRequest,
)
from src.services.reputation_service import compute_reputation


INTERNAL_KEY_HEADER = {"X-Internal-Key": "dev-internal-key-change-in-prod"}


def _mid_features() -> ReputationFeatures:
    return ReputationFeatures(
        response_rate=0.5,
        message_response_rate=0.5,
        avg_response_time_hours_norm=0.5,
        ghost_count_norm=0.2,
        consistency_score=0.5,
    )


def _make_predict_result(
    score_int: int,
    tier: str,
    factor_contributions: dict[str, float] | None = None,
    top_3: list[str] | None = None,
) -> dict:
    fc = factor_contributions or {
        "response_rate":           0.30,
        "message_response_rate":   0.20,
        "avg_response_time_hours": -0.10,
        "ghost_count":             -0.05,
        "consistency_score":       0.15,
    }
    t3 = top_3 or sorted(fc, key=lambda k: abs(fc[k]), reverse=True)[:3]
    return {
        "score_prob": score_int / 100,
        "score_int": score_int,
        "tier": tier,
        "factor_contributions": fc,
        "top_3_factors": t3,
    }


# ── 1: schema validation ─────────────────────────────────────────────────────
def test_request_schema_rejects_out_of_range_feature():
    with pytest.raises(ValueError):
        ReputationFeatures(
            response_rate=1.5,
            message_response_rate=0.5,
            avg_response_time_hours_norm=0.5,
            ghost_count_norm=0.0,
            consistency_score=0.5,
        )


def test_request_schema_rejects_missing_features():
    with pytest.raises(ValueError):
        ReputationRequest(user_id="u-1", features=None)  # type: ignore[arg-type]


def test_request_schema_accepts_valid_payload():
    req = ReputationRequest(user_id="u-1", features=_mid_features(), ghost_count_raw=2)
    assert req.user_id == "u-1"
    assert req.ghost_count_raw == 2


# ── 2: service ───────────────────────────────────────────────────────────────
def test_compute_returns_platinum_tier_for_high_score():
    fc = {
        "response_rate":           0.35,
        "message_response_rate":   0.30,
        "avg_response_time_hours": -0.20,
        "ghost_count":             -0.10,
        "consistency_score":       0.25,
    }
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(90, "platinum", fc),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-1", features=_mid_features(), ghost_count_raw=0)
        )
    assert result.tier == "platinum"
    assert result.reputation_score == 90
    # Strongest positive = response_rate → high_acceptance
    assert result.primary_strength == "high_acceptance"
    # Tier is high — no primary concern surfaced
    assert result.primary_concern is None


def test_compute_returns_flagged_tier_for_low_score():
    fc = {
        "response_rate":           -0.40,
        "message_response_rate":   -0.25,
        "avg_response_time_hours": 0.05,
        "ghost_count":             -0.35,
        "consistency_score":       -0.05,
    }
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(28, "flagged", fc),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-2", features=_mid_features(), ghost_count_raw=5)
        )
    assert result.tier == "flagged"
    assert result.reputation_score == 28
    # Most-negative contribution is response_rate → low_acceptance.
    assert result.primary_concern == "low_acceptance"
    assert result.ghost_count == 5


def test_compute_ghost_count_concern_when_silver_tier():
    fc = {
        "response_rate":           0.05,
        "message_response_rate":   0.02,
        "avg_response_time_hours": -0.01,
        "ghost_count":             -0.30,  # dominant negative
        "consistency_score":       0.01,
    }
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(60, "silver", fc),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-3", features=_mid_features(), ghost_count_raw=4)
        )
    assert result.tier == "silver"
    assert result.primary_concern == "ghoster"


def test_compute_neutral_midband_no_concern_for_gold():
    fc = {name: 0.01 for name in [
        "response_rate", "message_response_rate",
        "avg_response_time_hours", "ghost_count", "consistency_score",
    ]}
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(75, "gold", fc),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-4", features=_mid_features(), ghost_count_raw=0)
        )
    assert result.tier == "gold"
    # Highest tier — no primary concern even if a contribution sits below 0.
    assert result.primary_concern is None


def test_compute_disclaimer_always_present():
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(72, "gold"),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-5", features=_mid_features(), ghost_count_raw=1)
        )
    assert result.disclaimer == DISCLAIMER


def test_compute_feature_contributions_have_directions():
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(60, "silver"),
    ):
        result = compute_reputation(
            ReputationRequest(user_id="u-6", features=_mid_features(), ghost_count_raw=0)
        )
    assert len(result.feature_contributions) == 5
    for fc in result.feature_contributions:
        assert fc.direction in {"protective", "concern", "neutral"}


# ── 3: endpoint ──────────────────────────────────────────────────────────────
def test_endpoint_401_without_internal_key():
    client = TestClient(app)
    response = client.post(
        "/ai/reputation/predict",
        json={
            "user_id": "u-1",
            "features": _mid_features().model_dump(),
            "ghost_count_raw": 0,
        },
    )
    assert response.status_code == 401


def test_endpoint_200_happy_path():
    client = TestClient(app)
    with patch(
        "src.services.reputation_service.predict",
        return_value=_make_predict_result(82, "gold"),
    ):
        response = client.post(
            "/ai/reputation/predict",
            headers=INTERNAL_KEY_HEADER,
            json={
                "user_id": "u-1",
                "features": _mid_features().model_dump(),
                "ghost_count_raw": 0,
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["reputation_score"] == 82
    assert body["tier"] == "gold"
    assert body["user_id"] == "u-1"


def test_endpoint_422_on_malformed_body():
    client = TestClient(app)
    response = client.post(
        "/ai/reputation/predict",
        headers=INTERNAL_KEY_HEADER,
        json={"user_id": "u-1"},  # missing features
    )
    assert response.status_code == 422
