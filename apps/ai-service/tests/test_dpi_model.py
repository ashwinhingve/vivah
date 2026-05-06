"""
Tests for DPI synthetic data + sklearn model singleton.

These tests own the on-disk artifacts via tmp_path; they do not touch the
real apps/ai-service/models/ or data/ directories, so the live /health
probe stays usable in parallel.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pytest

from src.services import dpi_model, dpi_training
from src.services.dpi_training import (
    FEATURE_NAMES,
    generate_synthetic_data,
    train_model,
)


@pytest.fixture(autouse=True)
def _reset_dpi_singleton():
    """Each test starts with a cold module-level cache."""
    dpi_model._model = None
    dpi_model._metadata = None
    yield
    dpi_model._model = None
    dpi_model._metadata = None


@pytest.fixture
def trained_paths(tmp_path: Path) -> tuple[Path, Path]:
    model_path = tmp_path / "dpi_model.pkl"
    meta_path = tmp_path / "dpi_metadata.json"
    train_model(save_path=model_path, metadata_path=meta_path, n=400, seed=7)
    return model_path, meta_path


# ── 1 ────────────────────────────────────────────────────────────────────────
def test_synthetic_data_shape_and_balance(tmp_path: Path):
    csv = tmp_path / "syn.csv"
    X, y = generate_synthetic_data(n=1500, seed=42, save_csv=True, csv_path=csv)
    assert X.shape == (1500, len(FEATURE_NAMES))
    assert y.shape == (1500,)
    assert X.min() >= 0.0 and X.max() <= 1.0
    assert set(np.unique(y).tolist()).issubset({0, 1})
    assert csv.exists()


# ── 2 ────────────────────────────────────────────────────────────────────────
def test_synthetic_data_label_distribution_reasonable(tmp_path: Path):
    _, y = generate_synthetic_data(n=1500, seed=42, save_csv=False)
    pos_rate = float(y.mean())
    assert 0.30 <= pos_rate <= 0.70, f"unexpected positive rate {pos_rate}"


# ── 3 ────────────────────────────────────────────────────────────────────────
def test_train_model_saves_files(tmp_path: Path, monkeypatch):
    calls = {"dump": 0}
    real_dump = dpi_training.joblib.dump

    def spy_dump(*args, **kwargs):
        calls["dump"] += 1
        return real_dump(*args, **kwargs)

    monkeypatch.setattr(dpi_training.joblib, "dump", spy_dump)

    model_path = tmp_path / "m.pkl"
    meta_path = tmp_path / "m.json"
    metrics = train_model(save_path=model_path, metadata_path=meta_path, n=300, seed=1)

    assert calls["dump"] == 1
    assert model_path.exists()
    assert meta_path.exists()
    assert {"accuracy", "auc_roc", "brier_score", "n_samples"}.issubset(metrics)


# ── 4 ────────────────────────────────────────────────────────────────────────
def test_predict_returns_correct_shape(trained_paths):
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    out = dpi_model.predict({k: 0.5 for k in FEATURE_NAMES})
    assert set(out.keys()) == {"score", "level", "factor_contributions", "top_3_factors"}
    assert set(out["factor_contributions"].keys()) == set(FEATURE_NAMES)
    assert len(out["top_3_factors"]) == 3


# ── 5 ────────────────────────────────────────────────────────────────────────
def test_predict_score_in_valid_range_0_to_1(trained_paths):
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    for v in (0.0, 0.25, 0.5, 0.75, 1.0):
        out = dpi_model.predict({k: v for k in FEATURE_NAMES})
        assert 0.0 <= out["score"] <= 1.0


# ── 6 ────────────────────────────────────────────────────────────────────────
def test_predict_low_risk_inputs_yield_low_score(trained_paths):
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    out = dpi_model.predict({k: 0.0 for k in FEATURE_NAMES})
    assert out["level"] == "LOW", out
    assert out["score"] <= 0.30


# ── 7 ────────────────────────────────────────────────────────────────────────
def test_predict_high_risk_inputs_yield_high_score(trained_paths):
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    out = dpi_model.predict({k: 1.0 for k in FEATURE_NAMES})
    assert out["level"] == "HIGH", out
    assert out["score"] > 0.55


# ── 8 ────────────────────────────────────────────────────────────────────────
def test_predict_factor_contributions_sum_to_score(trained_paths):
    """
    Linear contributions are pre-sigmoid. Sigmoid(sum + intercept) ≈ score.
    """
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    feats = {k: 0.4 for k in FEATURE_NAMES}
    out = dpi_model.predict(feats)

    intercept = float(dpi_model._model.intercept_[0])
    total = sum(out["factor_contributions"].values()) + intercept
    reconstructed = 1.0 / (1.0 + math.exp(-total))
    assert abs(reconstructed - out["score"]) < 1e-6


# ── 9 ────────────────────────────────────────────────────────────────────────
def test_predict_top_3_factors_correctness(trained_paths):
    """
    Setting only 3 features non-zero forces those to dominate |contribution|.
    """
    model_path, meta_path = trained_paths
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    feats = {k: 0.0 for k in FEATURE_NAMES}
    chosen = ["income_disparity_pct", "education_gap", "family_values_alignment"]
    for c in chosen:
        feats[c] = 1.0
    out = dpi_model.predict(feats)
    assert set(out["top_3_factors"]) == set(chosen)


# ── 10 ───────────────────────────────────────────────────────────────────────
def test_load_model_idempotent(trained_paths, monkeypatch):
    model_path, meta_path = trained_paths
    calls = {"load": 0}
    real_load = dpi_model.joblib.load

    def spy_load(*args, **kwargs):
        calls["load"] += 1
        return real_load(*args, **kwargs)

    monkeypatch.setattr(dpi_model.joblib, "load", spy_load)

    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    dpi_model.load_model(model_path=model_path, metadata_path=meta_path)
    assert calls["load"] == 1
