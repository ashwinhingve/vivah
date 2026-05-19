"""
Stay Quotient prediction singleton. Lazy-loads the trained sklearn model —
auto-trains the first time if no `stay_model.pkl` is on disk.

Public API:
    FEATURE_NAMES         — list[str]   (7 ordered feature names)
    RISK_BAND_THRESHOLDS  — tuple[float, float, float]
    load_model()          — None        (idempotent)
    predict(features)     — dict        (score, band, contributions, primary)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from src.services.stay_training import (
    DEFAULT_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    normalize_features,
    train_model,
)

# (low_max, medium_max, high_max). Anything >= high_max is critical.
RISK_BAND_THRESHOLDS: tuple[float, float, float] = (0.25, 0.50, 0.75)

_model: Any = None
_explainer: Any = None
_metadata: dict | None = None


def _classify(score: float) -> str:
    low, med, high = RISK_BAND_THRESHOLDS
    if score < low:
        return "low"
    if score < med:
        return "medium"
    if score < high:
        return "high"
    return "critical"


def _reset_for_tests() -> None:
    """Test-only — clear singletons so a fresh load_model() runs."""
    global _model, _explainer, _metadata
    _model = None
    _explainer = None
    _metadata = None


def is_loaded() -> bool:
    """Cheap status — does NOT trigger model load. For /ready health probes."""
    return _model is not None


def load_model(
    model_path: str | Path = DEFAULT_MODEL_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
) -> None:
    """
    Load the cached calibrated predictor + explainer bundle. If absent on
    disk → train first, then load. Idempotent — subsequent calls return
    immediately.
    """
    global _model, _explainer, _metadata
    if _model is not None:
        return

    model_path = Path(model_path)
    metadata_path = Path(metadata_path)

    if not model_path.exists():
        train_model(save_path=model_path, metadata_path=metadata_path)

    bundle = joblib.load(model_path)
    _model = bundle["calibrated"]
    _explainer = bundle["explainer"]

    if metadata_path.exists():
        _metadata = json.loads(metadata_path.read_text())
    else:
        _metadata = {"feature_names": FEATURE_NAMES}


def predict(raw_features: dict) -> dict:
    """
    Score a single user's churn risk.

    Input: dict with all 7 raw feature keys (un-normalized).

    Returns:
      {
        "score": float (0..1, calibrated probability),
        "risk_band": "low" | "medium" | "high" | "critical",
        "factor_contributions": { feature: coef * x_normalized for each feature },
        "primary_signal": str   # feature with largest |contribution|
      }
    """
    load_model()

    missing = [k for k in FEATURE_NAMES if k not in raw_features]
    if missing:
        raise ValueError(f"Missing required Stay features: {missing}")

    normalized = normalize_features(raw_features)

    x = np.array([normalized[k] for k in FEATURE_NAMES], dtype=np.float64)
    proba = _model.predict_proba(x.reshape(1, -1))[0, 1]
    score = float(max(0.0, min(1.0, proba)))

    coef = _explainer.coef_[0]
    contributions = {name: float(coef[i] * x[i]) for i, name in enumerate(FEATURE_NAMES)}
    primary_signal = max(contributions, key=lambda k: abs(contributions[k]))

    return {
        "score": score,
        "risk_band": _classify(score),
        "factor_contributions": contributions,
        "primary_signal": primary_signal,
    }
