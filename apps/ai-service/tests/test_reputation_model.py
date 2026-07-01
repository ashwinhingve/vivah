"""
Tests for the Reputation Score sklearn singleton + synthetic data pipeline.

Mirrors test_dpi_model.py's pattern — each test starts with a cold module
cache and trains a small bundle into tmp_path so the live models/ directory
stays untouched.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from src.services import reputation_model
from src.services.reputation_training import (
    FEATURE_NAMES,
    generate_synthetic_data,
    train_model,
)


@pytest.fixture(autouse=True)
def _reset_reputation_singleton():
    reputation_model._model = None
    reputation_model._explainer = None
    reputation_model._metadata = None
    yield
    reputation_model._model = None
    reputation_model._explainer = None
    reputation_model._metadata = None


@pytest.fixture
def trained_paths(tmp_path: Path) -> tuple[Path, Path]:
    model_path = tmp_path / "reputation_model.pkl"
    meta_path = tmp_path / "reputation_metadata.json"
    train_model(save_path=model_path, metadata_path=meta_path, n=400, seed=7)
    return model_path, meta_path


def test_synthetic_data_shape_and_balance(tmp_path: Path):
    csv = tmp_path / "syn.csv"
    X, y = generate_synthetic_data(n=1500, seed=42, save_csv=True, csv_path=csv)
    assert X.shape == (1500, len(FEATURE_NAMES))
    assert y.shape == (1500,)
    assert X.min() >= 0.0 and X.max() <= 1.0
    assert set(np.unique(y).tolist()).issubset({0, 1})
    assert csv.exists()


def test_synthetic_data_label_distribution_reasonable():
    _, y = generate_synthetic_data(n=1500, seed=42, save_csv=False)
    pos_rate = float(y.mean())
    assert 0.25 <= pos_rate <= 0.75, f"unexpected positive rate {pos_rate}"


def test_train_model_saves_artifacts(tmp_path: Path):
    model_path = tmp_path / "m.pkl"
    meta_path = tmp_path / "m.json"
    metrics = train_model(save_path=model_path, metadata_path=meta_path, n=300, seed=1)
    assert model_path.exists()
    assert meta_path.exists()
    assert {"accuracy", "auc_roc", "brier_score", "n_samples"}.issubset(metrics)
    assert metrics["n_samples"] == 300


def test_load_model_idempotent(trained_paths, monkeypatch):
    model_path, meta_path = trained_paths
    calls = {"load": 0}
    real_load = reputation_model.joblib.load

    def spy_load(*args, **kwargs):
        calls["load"] += 1
        return real_load(*args, **kwargs)

    monkeypatch.setattr(reputation_model.joblib, "load", spy_load)
    reputation_model.load_model(model_path=model_path, metadata_path=meta_path)
    reputation_model.load_model(model_path=model_path, metadata_path=meta_path)
    assert calls["load"] == 1


def test_predict_full_feature_dict_returns_expected_keys(trained_paths):
    model_path, meta_path = trained_paths
    reputation_model.load_model(model_path=model_path, metadata_path=meta_path)
    result = reputation_model.predict({
        "response_rate": 0.85,
        "message_response_rate": 0.7,
        "avg_response_time_hours": 0.05,
        "ghost_count": 0.0,
        "consistency_score": 0.85,
    })
    assert {
        "score_prob", "score_int", "tier", "factor_contributions", "top_3_factors"
    } == set(result)
    assert 0.0 <= result["score_prob"] <= 1.0
    assert 0 <= result["score_int"] <= 100
    assert result["tier"] in {"platinum", "gold", "silver", "bronze", "flagged"}
    assert len(result["top_3_factors"]) == 3


def test_predict_high_trust_features_score_above_baseline(trained_paths):
    model_path, meta_path = trained_paths
    reputation_model.load_model(model_path=model_path, metadata_path=meta_path)
    high = reputation_model.predict({
        "response_rate": 0.9,
        "message_response_rate": 0.85,
        "avg_response_time_hours": 0.05,
        "ghost_count": 0.0,
        "consistency_score": 0.85,
    })
    low = reputation_model.predict({
        "response_rate": 0.1,
        "message_response_rate": 0.1,
        "avg_response_time_hours": 0.85,
        "ghost_count": 0.6,
        "consistency_score": 0.2,
    })
    assert high["score_int"] > low["score_int"]


def test_predict_missing_feature_raises(trained_paths):
    model_path, meta_path = trained_paths
    reputation_model.load_model(model_path=model_path, metadata_path=meta_path)
    with pytest.raises(ValueError, match="Missing"):
        reputation_model.predict({"response_rate": 0.5})


def test_classify_tier_boundaries():
    assert reputation_model.classify_tier(100) == "platinum"
    assert reputation_model.classify_tier(85) == "platinum"
    assert reputation_model.classify_tier(84) == "gold"
    assert reputation_model.classify_tier(70) == "gold"
    assert reputation_model.classify_tier(69) == "silver"
    assert reputation_model.classify_tier(55) == "silver"
    assert reputation_model.classify_tier(54) == "bronze"
    assert reputation_model.classify_tier(40) == "bronze"
    assert reputation_model.classify_tier(39) == "flagged"
    assert reputation_model.classify_tier(0) == "flagged"
