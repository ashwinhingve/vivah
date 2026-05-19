"""
FAQ (Function Attendance Quotient) prediction singleton.

Lazy-loads the trained GradientBoosting model — auto-trains the first time
if no faq_model.pkl is on disk.

Public API:
    FEATURE_NAMES   — list[str]   (14 ordered feature names)
    load_model()    — None        (idempotent)
    encode_features(input_dict) — np.ndarray  shape (1, 14)
    predict(features) — dict      (predicted_probability, confidence_band, contributions)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np

from src.services.faq_training import (
    DEFAULT_METADATA_PATH,
    DEFAULT_MODEL_PATH,
    FEATURE_NAMES,
    train_model,
)

# Module-level singletons — None until load_model() is called
_model: Any = None
_bundle: Any = None
_metadata: Optional[dict] = None


def is_loaded() -> bool:
    """Cheap status — does NOT trigger model load. For /ready health probes."""
    return _bundle is not None


def load_model(
    model_path: str | Path = DEFAULT_MODEL_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
) -> None:
    """
    Load the calibrated FAQ model bundle. If absent on disk → train first,
    then load. Idempotent — subsequent calls return immediately.
    """
    global _model, _bundle, _metadata

    if _bundle is not None:
        return

    model_path = Path(model_path)
    metadata_path = Path(metadata_path)

    if not model_path.exists():
        train_model(save_path=model_path, metadata_path=metadata_path)

    _bundle = joblib.load(model_path)
    _model = _bundle["calibrated"]

    if metadata_path.exists():
        _metadata = json.loads(metadata_path.read_text())
    else:
        _metadata = {"feature_names": FEATURE_NAMES}


def encode_features(input_dict: dict) -> np.ndarray:
    """
    Build the 14-dim feature vector from a structured FaqInput dict.

    Canonical order:
      [0]  rel_close_family
      [1]  rel_extended_family
      [2]  rel_friend
      [3]  rel_colleague
      [4]  distance_km_normalized  (capped at 1500)
      [5]  rsvp_yes
      [6]  rsvp_no
      [7]  rsvp_maybe
      [8]  rsvp_pending
      [9]  ceremony_sangeet
      [10] ceremony_mehndi
      [11] ceremony_wedding
      [12] ceremony_reception
      [13] historical_attendance_rate  (default 0.5 when None)

    Returns shape (1, 14).
    """
    relationship = input_dict["relationship_type"]
    distance_km = float(input_dict["distance_km"])
    rsvp = input_dict["rsvp_response"]
    ceremony = input_dict["ceremony_type"]
    historical = input_dict.get("historical_attendance_rate")

    # Relationship one-hot (0-3)
    rel_close_family = 1.0 if relationship == "close_family" else 0.0
    rel_extended_family = 1.0 if relationship == "extended_family" else 0.0
    rel_friend = 1.0 if relationship == "friend" else 0.0
    rel_colleague = 1.0 if relationship == "colleague" else 0.0

    # Distance normalized (4) — cap at 1500
    distance_norm = min(distance_km, 1500.0) / 1500.0

    # RSVP one-hot (5-8)
    rsvp_yes = 1.0 if rsvp == "yes" else 0.0
    rsvp_no = 1.0 if rsvp == "no" else 0.0
    rsvp_maybe = 1.0 if rsvp == "maybe" else 0.0
    rsvp_pending = 1.0 if rsvp == "pending" else 0.0

    # Ceremony one-hot (9-12)
    cer_sangeet = 1.0 if ceremony == "sangeet" else 0.0
    cer_mehndi = 1.0 if ceremony == "mehndi" else 0.0
    cer_wedding = 1.0 if ceremony == "wedding" else 0.0
    cer_reception = 1.0 if ceremony == "reception" else 0.0

    # Historical attendance rate (13) — default 0.5 when None
    hist_rate = float(historical) if historical is not None else 0.5

    vector = [
        rel_close_family,
        rel_extended_family,
        rel_friend,
        rel_colleague,
        distance_norm,
        rsvp_yes,
        rsvp_no,
        rsvp_maybe,
        rsvp_pending,
        cer_sangeet,
        cer_mehndi,
        cer_wedding,
        cer_reception,
        hist_rate,
    ]
    return np.array(vector, dtype=np.float64).reshape(1, 14)


def _confidence_band(proba: float) -> str:
    """
    Direction-aware confidence band based on calibrated probability.

    Treats absence as a confident signal symmetrically with attendance:
    a 0.04 probability is "high confidence will skip", not "low".

      >= 0.85           high   (high confidence will attend)
      0.55 .. 0.85      medium (likely attend)
      0.35 .. 0.55      low    (uncertain — central band)
      0.15 .. 0.35      medium (likely skip)
      <  0.15           high   (high confidence will skip)
    """
    if proba >= 0.85:
        return "high"
    if proba >= 0.55:
        return "medium"
    if proba >= 0.35:
        return "low"
    if proba >= 0.15:
        return "medium"
    return "high"


def _direction(proba: float) -> str:
    """
    Attendance direction. Uncertain band is checked first so the central
    [0.40, 0.60] window does not silently flip on small probability shifts.

      0.40 .. 0.60   uncertain
      > 0.60         attend
      < 0.40         skip
    """
    if 0.40 <= proba <= 0.60:
        return "uncertain"
    if proba > 0.60:
        return "attend"
    return "skip"


def predict(features: dict) -> dict:
    """
    Predict attendance probability for a single guest+ceremony.

    Input: dict matching FaqInput fields.

    Returns:
      {
        "predicted_probability": float (0..1, calibrated),
        "confidence_band": "high" | "medium" | "low",
        "direction": "attend" | "skip" | "uncertain",
        "feature_contributions": [
            {"feature": str, "value": float, "contribution": float}
            ...14 items...
        ],
        "model_version": "faq-v1.0",
      }
    """
    load_model()

    x = encode_features(features)
    proba = float(_bundle["calibrated"].predict_proba(x)[0, 1])

    importances: list[float] = _bundle["feature_importances"]
    names: list[str] = _bundle["feature_names"]

    contributions = [
        {
            "feature": names[i],
            "value": float(x[0, i]),
            "contribution": float(importances[i]),
        }
        for i in range(14)
    ]

    band = _confidence_band(proba)
    direction = _direction(proba)

    return {
        "predicted_probability": proba,
        "confidence_band": band,
        "direction": direction,
        "feature_contributions": contributions,
        "model_version": "faq-v1.0",
    }
