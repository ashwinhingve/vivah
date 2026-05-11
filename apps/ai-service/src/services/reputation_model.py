"""
Reputation Score prediction singleton. Lazy-loads the trained sklearn bundle —
auto-trains on first call if `reputation_model.pkl` is absent on disk.

Public API:
    FEATURE_NAMES         — list[str] (5 ordered feature names)
    TIER_THRESHOLDS       — tuple[int, int, int, int]
    load_model()          — None (idempotent)
    predict(features)     — dict (probability, tier, contributions, top 3)
    classify_tier(score)  — str  ('platinum'|'gold'|'silver'|'bronze'|'flagged')
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from src.services.reputation_training import (
    DEFAULT_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    train_model,
)

# (platinum_min, gold_min, silver_min, bronze_min) — anything below bronze_min
# is "flagged". Thresholds are on the 0..100 integer score.
TIER_THRESHOLDS: tuple[int, int, int, int] = (85, 70, 55, 40)

_model: Any = None
_explainer: Any = None
_metadata: dict | None = None


def classify_tier(score_0_to_100: int) -> str:
    plat, gold, silver, bronze = TIER_THRESHOLDS
    if score_0_to_100 >= plat:
        return "platinum"
    if score_0_to_100 >= gold:
        return "gold"
    if score_0_to_100 >= silver:
        return "silver"
    if score_0_to_100 >= bronze:
        return "bronze"
    return "flagged"


def load_model(
    model_path: str | Path = DEFAULT_MODEL_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
) -> None:
    """Load (or train + load) the bundle. Idempotent."""
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


def predict(features: dict) -> dict:
    """
    Score a single user's reputation features.

    Input: dict with all 5 FEATURE_NAMES keys, each float in [0, 1].

    Returns:
      {
        "score_prob": float (0..1, calibrated probability of being trustworthy),
        "score_int":  int   (0..100, rounded),
        "tier":       str   (platinum|gold|silver|bronze|flagged),
        "factor_contributions": { feature: coef * x for each feature },
        "top_3_factors": [feature, ...]   # ordered by |contribution| desc
      }
    """
    load_model()

    missing = [k for k in FEATURE_NAMES if k not in features]
    if missing:
        raise ValueError(f"Missing required Reputation features: {missing}")
    extra = [k for k in features if k not in FEATURE_NAMES]
    if extra:
        raise ValueError(f"Unknown Reputation features: {extra}")

    x = np.array([float(features[k]) for k in FEATURE_NAMES], dtype=np.float64)
    proba = _model.predict_proba(x.reshape(1, -1))[0, 1]
    score_prob = float(proba)
    score_int = int(round(score_prob * 100))

    coef = _explainer.coef_[0]
    contributions = {name: float(coef[i] * x[i]) for i, name in enumerate(FEATURE_NAMES)}
    top_3 = sorted(contributions, key=lambda k: abs(contributions[k]), reverse=True)[:3]

    return {
        "score_prob": score_prob,
        "score_int": score_int,
        "tier": classify_tier(score_int),
        "factor_contributions": contributions,
        "top_3_factors": top_3,
    }
