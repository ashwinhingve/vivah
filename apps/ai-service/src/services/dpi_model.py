"""
DPI prediction singleton. Lazy-loads the trained sklearn model — auto-trains
the first time if no `dpi_model.pkl` is on disk.

Public API:
    FEATURE_NAMES         — list[str]   (10 ordered feature names)
    load_model()          — None        (idempotent)
    predict(features)     — dict        (score, level, contributions, top 3)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from src.services.dpi_training import (
    DEFAULT_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    train_model,
)

logger = logging.getLogger(__name__)

LEVEL_THRESHOLDS: tuple[float, float] = (0.30, 0.55)

# Predictor: CalibratedClassifierCV wrapping LogisticRegression — used for the
# final, realistic probability score. Lacks a stable single coef_/intercept_.
_model: Any = None
# Explainer: plain LogisticRegression on the full training set — used solely
# to derive factor_contributions and the top_3_factors list.
_explainer: Any = None
_metadata: dict | None = None


def is_loaded() -> bool:
    """Cheap status — does NOT trigger model load. For /ready health probes."""
    return _model is not None


def _classify(score: float) -> str:
    low, med = LEVEL_THRESHOLDS
    if score <= low:
        return "LOW"
    if score <= med:
        return "MEDIUM"
    return "HIGH"


def _load_or_retrain(
    model_path: Path, metadata_path: Path
) -> dict:
    """Load model bundle or retrain if load fails."""
    if not model_path.exists():
        train_model(save_path=model_path, metadata_path=metadata_path)
    try:
        return joblib.load(model_path)
    except Exception as exc:
        logger.warning(
            "model load failed (%s); retraining %s", exc, model_path
        )
        train_model(save_path=model_path, metadata_path=metadata_path)
        return joblib.load(model_path)


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

    bundle = _load_or_retrain(model_path, metadata_path)
    _model = bundle["calibrated"]
    _explainer = bundle["explainer"]

    if metadata_path.exists():
        _metadata = json.loads(metadata_path.read_text())
    else:
        _metadata = {"feature_names": FEATURE_NAMES}


def predict(features: dict) -> dict:
    """
    Score a single (profile-pair) feature dict.

    Input: dict with all 10 FEATURE_NAMES keys, each float in [0, 1].

    Returns:
      {
        "score": float (0..1, calibrated probability),
        "level": "LOW" | "MEDIUM" | "HIGH",
        "factor_contributions": { feature: coef * x for each feature },
        "top_3_factors": [feature, ...]   # ordered by |contribution| desc
      }
    """
    load_model()

    missing = [k for k in FEATURE_NAMES if k not in features]
    if missing:
        raise ValueError(f"Missing required DPI features: {missing}")
    extra = [k for k in features if k not in FEATURE_NAMES]
    if extra:
        raise ValueError(f"Unknown DPI features: {extra}")

    x = np.array([float(features[k]) for k in FEATURE_NAMES], dtype=np.float64)
    proba = _model.predict_proba(x.reshape(1, -1))[0, 1]
    score = float(proba)

    coef = _explainer.coef_[0]
    contributions = {name: float(coef[i] * x[i]) for i, name in enumerate(FEATURE_NAMES)}
    top_3 = sorted(contributions, key=lambda k: abs(contributions[k]), reverse=True)[:3]

    return {
        "score": score,
        "level": _classify(score),
        "factor_contributions": contributions,
        "top_3_factors": top_3,
    }
