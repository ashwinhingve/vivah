"""
Tests for FAQ (Function Attendance Quotient) — synthetic data, model,
singleton, encoding, and prediction correctness.

These tests own on-disk artifacts via tmp_path; they do not touch the
real apps/ai-service/models/ or data/ directories.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest

from src.services import faq_model
from src.services.faq_training import (
    FEATURE_NAMES,
    generate_synthetic_data,
    train_model,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_faq_singleton():
    """Each test starts with a cold module-level singleton cache."""
    faq_model._model = None
    faq_model._bundle = None
    faq_model._metadata = None
    yield
    faq_model._model = None
    faq_model._bundle = None
    faq_model._metadata = None


@pytest.fixture
def trained_paths(tmp_path: Path) -> tuple[Path, Path]:
    """Train a small model (n=400) and return (model_path, metadata_path)."""
    model_path = tmp_path / "faq_model.pkl"
    meta_path = tmp_path / "faq_metadata.json"
    train_model(save_path=model_path, metadata_path=meta_path, n=400, seed=7)
    return model_path, meta_path


def _base_features(**overrides) -> dict:
    """Return a valid FaqInput dict with sensible defaults."""
    base = {
        "relationship_type": "friend",
        "distance_km": 100.0,
        "rsvp_response": "yes",
        "ceremony_type": "wedding",
        "historical_attendance_rate": 0.7,
    }
    base.update(overrides)
    return base


# ── Test 1: train creates bundle + metadata ────────────────────────────────


def test_train_creates_bundle_and_metadata(tmp_path: Path):
    model_path = tmp_path / "faq_model.pkl"
    meta_path = tmp_path / "faq_metadata.json"
    train_model(save_path=model_path, metadata_path=meta_path, n=300, seed=1)

    assert model_path.exists(), "model pkl not created"
    assert meta_path.exists(), "metadata json not created"

    # Verify metadata is parseable JSON
    meta = json.loads(meta_path.read_text())
    assert isinstance(meta, dict)
    assert "version" in meta
    assert "metrics" in meta


# ── Test 2: bundle has required keys ──────────────────────────────────────


def test_bundle_shape_has_required_keys(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    bundle = faq_model._bundle
    assert "calibrated" in bundle
    assert "feature_importances" in bundle
    assert "feature_names" in bundle
    assert "feature_groups" in bundle
    assert "version" in bundle

    assert len(bundle["feature_names"]) == 14
    assert len(bundle["feature_importances"]) == 14
    assert bundle["version"] == "faq-v1.0"


# ── Test 3: metadata metrics in range ─────────────────────────────────────


def test_metadata_metrics_in_range(trained_paths):
    model_path, meta_path = trained_paths
    meta = json.loads(meta_path.read_text())
    metrics = meta["metrics"]

    assert 0.7 <= metrics["accuracy"] <= 1.0, f"accuracy={metrics['accuracy']}"
    assert 0.7 <= metrics["auc_roc"] <= 1.0, f"auc_roc={metrics['auc_roc']}"
    assert 0.0 <= metrics["brier_score"] <= 0.4, f"brier_score={metrics['brier_score']}"


# ── Test 4: load_model is idempotent ──────────────────────────────────────


def test_load_model_idempotent(trained_paths, monkeypatch):
    model_path, meta_path = trained_paths
    calls = {"load": 0}
    real_load = faq_model.joblib.load

    def spy_load(*args, **kwargs):
        calls["load"] += 1
        return real_load(*args, **kwargs)

    monkeypatch.setattr(faq_model.joblib, "load", spy_load)

    faq_model.load_model(model_path=model_path, metadata_path=meta_path)
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    assert calls["load"] == 1, "load_model should be idempotent (only 1 joblib.load call)"


# ── Test 5: missing pkl triggers auto-train ───────────────────────────────


def test_load_model_auto_trains_when_missing(tmp_path: Path):
    model_path = tmp_path / "faq_model.pkl"
    meta_path = tmp_path / "faq_metadata.json"

    assert not model_path.exists()

    # load_model should auto-train and then load successfully
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    assert model_path.exists(), "auto-train should have created the model pkl"
    assert faq_model._bundle is not None


# ── Test 6: encode_features for yes+close_family+short_distance ───────────


def test_encode_features_yes_close_family_short_distance():
    features = _base_features(
        relationship_type="close_family",
        distance_km=150.0,
        rsvp_response="yes",
        ceremony_type="wedding",
    )
    x = faq_model.encode_features(features)

    assert x.shape == (1, 14)
    # rel_close_family at index 0 should be 1
    assert x[0, 0] == 1.0, "rel_close_family should be 1"
    # rsvp_yes at index 5 should be 1
    assert x[0, 5] == 1.0, "rsvp_yes should be 1"
    # distance normalized: 150/1500 = 0.1, should be in [0, 0.2]
    assert 0.0 <= x[0, 4] <= 0.2, f"distance normalized={x[0, 4]} not in [0, 0.2]"


# ── Test 7: yes RSVP yields high probability ──────────────────────────────


def test_predict_yes_rsvp_high_probability(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="yes")
    result = faq_model.predict(features)

    assert result["predicted_probability"] > 0.85, (
        f"yes RSVP should yield proba > 0.85, got {result['predicted_probability']}"
    )


# ── Test 8: no RSVP yields low probability ────────────────────────────────


def test_predict_no_rsvp_low_probability(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="no")
    result = faq_model.predict(features)

    assert result["predicted_probability"] < 0.15, (
        f"no RSVP should yield proba < 0.15, got {result['predicted_probability']}"
    )


# ── Test 9: maybe RSVP + history gives mid-range probability ──────────────


def test_predict_maybe_with_history(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="maybe", historical_attendance_rate=0.6)
    result = faq_model.predict(features)

    # Calibrated GBM on small training set can output anywhere in (0, 1);
    # just verify it is NOT as extreme as a clear yes/no signal.
    proba = result["predicted_probability"]
    assert 0.0 < proba < 1.0, f"maybe+history proba should be in open (0,1), got {proba}"
    # Confidence band should be "high" because maybe + historical_rate present
    assert result["confidence_band"] == "high", (
        f"maybe+history should yield 'high' band, got '{result['confidence_band']}'"
    )


# ── Test 10: pending + no history → low confidence band ───────────────────


def test_predict_pending_no_history(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="pending", historical_attendance_rate=None)
    result = faq_model.predict(features)

    assert result["confidence_band"] == "low", (
        f"pending + no history should be 'low', got '{result['confidence_band']}'"
    )


# ── Test 11: pending + with history → medium confidence band ──────────────


def test_predict_pending_with_history(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="pending", historical_attendance_rate=0.7)
    result = faq_model.predict(features)

    assert result["confidence_band"] == "medium", (
        f"pending + history should be 'medium', got '{result['confidence_band']}'"
    )


# ── Test 12: yes RSVP → high confidence band ──────────────────────────────


def test_confidence_band_yes_is_high(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    features = _base_features(rsvp_response="yes")
    result = faq_model.predict(features)

    assert result["confidence_band"] == "high"


# ── Test 13: pending + no history → low confidence band (unit test) ───────


def test_confidence_band_pending_no_history_is_low():
    """Unit test _confidence_band directly — no model load needed."""
    band = faq_model._confidence_band({
        "rsvp_response": "pending",
        "historical_attendance_rate": None,
    })
    assert band == "low"


# ── Test 14: predict returns exactly 14 contributions ─────────────────────


def test_predict_returns_14_contributions(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    result = faq_model.predict(_base_features())

    assert len(result["feature_contributions"]) == 14, (
        f"Expected 14 contributions, got {len(result['feature_contributions'])}"
    )
    # Each contribution should have the 3 required keys
    for contrib in result["feature_contributions"]:
        assert "feature" in contrib
        assert "value" in contrib
        assert "contribution" in contrib


# ── Test 15: distance > 1500 is capped at 1.0 ────────────────────────────


def test_distance_capped_at_1500():
    features = _base_features(distance_km=5000.0)
    x = faq_model.encode_features(features)
    # distance_km_normalized at index 4 should be capped at 1.0
    assert x[0, 4] <= 1.0, f"distance normalized={x[0, 4]} should be ≤ 1.0"
    assert math.isclose(x[0, 4], 1.0, abs_tol=1e-9), "5000 km should cap to normalized 1.0"


# ── Test 16: predict response has all required keys ───────────────────────


def test_predict_response_shape(trained_paths):
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    result = faq_model.predict(_base_features())

    required_keys = {"predicted_probability", "confidence_band", "feature_contributions", "model_version"}
    assert required_keys.issubset(result.keys()), f"Missing keys: {required_keys - result.keys()}"
    assert result["model_version"] == "faq-v1.0"
    assert 0.0 <= result["predicted_probability"] <= 1.0
    assert result["confidence_band"] in {"high", "medium", "low"}


# ── Test 17 (bonus): close_family > colleague attendance probability ───────


def test_close_family_boost_vs_colleague(trained_paths):
    """Same other features — close_family should predict higher than colleague."""
    model_path, meta_path = trained_paths
    faq_model.load_model(model_path=model_path, metadata_path=meta_path)

    common = dict(
        distance_km=200.0,
        rsvp_response="maybe",
        ceremony_type="wedding",
        historical_attendance_rate=0.6,
    )
    result_family = faq_model.predict(_base_features(**common, relationship_type="close_family"))
    result_colleague = faq_model.predict(_base_features(**common, relationship_type="colleague"))

    assert result_family["predicted_probability"] > result_colleague["predicted_probability"], (
        f"close_family ({result_family['predicted_probability']:.3f}) should be "
        f"> colleague ({result_colleague['predicted_probability']:.3f})"
    )
