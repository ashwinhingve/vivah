"""
Stay Quotient service tests — covers training pipeline, prediction shape,
risk-band classification, primary-signal selection, recommended-action map,
score clamping, normalization caps, and schema validation.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import joblib
import numpy as np
import pytest
from pydantic import ValidationError

from src.schemas.stay import (
    MODEL_VERSION,
    RECOMMENDED_ACTIONS,
    StayRequest,
    StayResponse,
)
from src.services.stay_model import (
    FEATURE_NAMES,
    RISK_BAND_THRESHOLDS,
    _classify,
    _reset_for_tests,
    predict,
)
from src.services.stay_service import compute_stay
from src.services.stay_training import (
    FEATURE_CAPS,
    generate_synthetic_data,
    normalize_features,
    train_model,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_model_singleton():
    """Force a fresh load_model() per test so trained_paths fixtures isolate."""
    _reset_for_tests()
    yield
    _reset_for_tests()


@pytest.fixture
def trained_paths(tmp_path: Path) -> tuple[Path, Path]:
    """Train a real model into tmp_path so tests touch joblib end-to-end."""
    model_path = tmp_path / "stay_model.pkl"
    metadata_path = tmp_path / "stay_metadata.json"
    train_model(save_path=model_path, metadata_path=metadata_path)
    return model_path, metadata_path


def _engaged_user() -> dict:
    return {
        "days_since_last_login": 0.5,
        "messages_sent_last_7d": 25,
        "profile_views_received_7d": 12,
        "matches_accepted_total": 5,
        "profile_completeness": 90,
        "days_since_signup": 60,
        "has_active_match_request": True,
    }


def _disengaged_user() -> dict:
    return {
        "days_since_last_login": 25.0,
        "messages_sent_last_7d": 0,
        "profile_views_received_7d": 0,
        "matches_accepted_total": 0,
        "profile_completeness": 30,
        "days_since_signup": 60,
        "has_active_match_request": False,
    }


# ---------------------------------------------------------------------------
# Training pipeline
# ---------------------------------------------------------------------------


def test_train_model_creates_artifacts(trained_paths):
    """1. train_model writes both pkl bundle and metadata json."""
    model_path, metadata_path = trained_paths
    assert model_path.exists()
    assert metadata_path.exists()
    bundle = joblib.load(model_path)
    assert "calibrated" in bundle
    assert "explainer" in bundle


def test_synthetic_data_is_reproducible():
    """2. Same seed → identical (X, y)."""
    X1, y1 = generate_synthetic_data(n=100, seed=42, save_csv=False)
    X2, y2 = generate_synthetic_data(n=100, seed=42, save_csv=False)
    assert np.array_equal(X1, X2)
    assert np.array_equal(y1, y2)
    assert X1.shape == (100, len(FEATURE_NAMES))


# ---------------------------------------------------------------------------
# Singleton + load idempotency
# ---------------------------------------------------------------------------


def test_load_model_idempotent(trained_paths):
    """3. Loading twice does not re-deserialize (singleton stays set)."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    first = sm._model
    sm.load_model(*trained_paths)
    assert sm._model is first


# ---------------------------------------------------------------------------
# Risk-band classification
# ---------------------------------------------------------------------------


def test_classify_low_band():
    """4. score < 0.25 → 'low'."""
    assert _classify(0.0) == "low"
    assert _classify(0.24999) == "low"


def test_classify_medium_band():
    """5. 0.25 <= score < 0.50 → 'medium'."""
    assert _classify(0.25) == "medium"
    assert _classify(0.49999) == "medium"


def test_classify_high_band():
    """6. 0.50 <= score < 0.75 → 'high'."""
    assert _classify(0.50) == "high"
    assert _classify(0.74999) == "high"


def test_classify_critical_band():
    """7. score >= 0.75 → 'critical'."""
    assert _classify(0.75) == "critical"
    assert _classify(1.00) == "critical"


# ---------------------------------------------------------------------------
# Predict pipeline (with trained bundle)
# ---------------------------------------------------------------------------


def test_predict_returns_full_shape(trained_paths):
    """8. predict() returns score, risk_band, contributions for all 7 features, primary_signal."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    result = predict(_disengaged_user())
    assert 0.0 <= result["score"] <= 1.0
    assert result["risk_band"] in {"low", "medium", "high", "critical"}
    assert set(result["factor_contributions"].keys()) == set(FEATURE_NAMES)
    assert result["primary_signal"] in FEATURE_NAMES


def test_predict_disengaged_user_high_or_critical(trained_paths):
    """9. Zero-engagement, stale login → high or critical band."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    result = predict(_disengaged_user())
    assert result["risk_band"] in {"high", "critical"}


def test_predict_engaged_user_low_or_medium(trained_paths):
    """10. Active, complete-profile user → low or medium band."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    result = predict(_engaged_user())
    assert result["risk_band"] in {"low", "medium"}


def test_predict_missing_feature_raises(trained_paths):
    """11. Missing required feature → ValueError."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    incomplete = _engaged_user()
    incomplete.pop("messages_sent_last_7d")
    with pytest.raises(ValueError, match="Missing required"):
        predict(incomplete)


# ---------------------------------------------------------------------------
# Normalization caps
# ---------------------------------------------------------------------------


def test_normalize_caps_oversized_values():
    """12. Raw values above caps are clamped before scaling."""
    raw = {
        "days_since_last_login": 999.0,
        "messages_sent_last_7d": 9999,
        "profile_views_received_7d": 9999,
        "matches_accepted_total": 9999,
        "profile_completeness": 9999,
        "days_since_signup": 9999,
        "has_active_match_request": True,
    }
    out = normalize_features(raw)
    for v in out.values():
        assert 0.0 <= v <= 1.0
    assert out["days_since_last_login"] == pytest.approx(1.0)
    assert out["has_active_match_request"] == 1.0


def test_normalize_handles_bool_feature():
    """13. has_active_match_request bool maps to 0/1."""
    raw_true = {name: 0 for name in FEATURE_CAPS}
    raw_true["has_active_match_request"] = True
    raw_false = {name: 0 for name in FEATURE_CAPS}
    raw_false["has_active_match_request"] = False
    assert normalize_features(raw_true)["has_active_match_request"] == 1.0
    assert normalize_features(raw_false)["has_active_match_request"] == 0.0


# ---------------------------------------------------------------------------
# Service / response shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_compute_stay_returns_response_with_action(trained_paths):
    """14. compute_stay maps primary_signal to a recommended_action."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    req = StayRequest(user_id="u-1", **_disengaged_user())
    resp: StayResponse = await compute_stay(req)
    assert resp.user_id == "u-1"
    assert resp.model_version == MODEL_VERSION
    assert resp.recommended_action == RECOMMENDED_ACTIONS[resp.primary_signal]
    assert len(resp.feature_contributions) == len(FEATURE_NAMES)


@pytest.mark.asyncio
async def test_compute_stay_score_clamped(trained_paths):
    """15. Even if predict returns >1.0 (floating overshoot), response stays in [0, 1]."""
    from src.services import stay_model as sm

    sm.load_model(*trained_paths)
    req = StayRequest(user_id="u-2", **_engaged_user())

    fake = {
        "score": 1.000_000_1,
        "risk_band": "critical",
        "factor_contributions": {name: 0.0 for name in FEATURE_NAMES},
        "primary_signal": "days_since_last_login",
    }
    with patch("src.services.stay_service.predict", return_value=fake):
        resp = await compute_stay(req)
    # The orchestrator passes score through; clamping happens in predict().
    # Pydantic validates 0..1 — so if predict() returned 1.0000001 unclamped
    # we'd get a ValidationError. predict() does clamp; here we assert the
    # response stayed in range.
    assert 0.0 <= resp.churn_probability <= 1.0


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------


def test_schema_rejects_negative_values():
    """16. StayRequest rejects negative numeric fields."""
    with pytest.raises(ValidationError):
        StayRequest(
            user_id="u",
            days_since_last_login=-1,
            messages_sent_last_7d=0,
            profile_views_received_7d=0,
            matches_accepted_total=0,
            profile_completeness=50,
            days_since_signup=10,
            has_active_match_request=False,
        )


def test_schema_rejects_completeness_over_100():
    """17. profile_completeness must be <= 100."""
    with pytest.raises(ValidationError):
        StayRequest(
            user_id="u",
            days_since_last_login=1,
            messages_sent_last_7d=0,
            profile_views_received_7d=0,
            matches_accepted_total=0,
            profile_completeness=150,
            days_since_signup=10,
            has_active_match_request=False,
        )


# ---------------------------------------------------------------------------
# Risk-band sanity vs threshold tuple
# ---------------------------------------------------------------------------


def test_risk_band_thresholds_constant():
    """18. The 4-band thresholds remain (0.25, 0.50, 0.75)."""
    assert RISK_BAND_THRESHOLDS == (0.25, 0.50, 0.75)
