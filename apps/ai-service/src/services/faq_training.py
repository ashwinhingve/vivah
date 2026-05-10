"""
FAQ (Function Attendance Quotient) synthetic data generation + GradientBoosting trainer.

Trains a CalibratedClassifierCV wrapping GradientBoostingClassifier on ~2000 synthetic
rows of wedding guest RSVP data to predict per-guest attendance probability.

14-feature vector (canonical order):
  Indices 0-3:  relationship_type one-hot {close_family, extended_family, friend, colleague}
  Index 4:      distance_km_normalized (cap at 1500, divide by 1500)
  Indices 5-8:  rsvp_response one-hot {yes, no, maybe, pending}
  Indices 9-12: ceremony_type one-hot {sangeet, mehndi, wedding, reception}
  Index 13:     historical_attendance_rate (0..1; default 0.5 if null)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score

FEATURE_NAMES: list[str] = [
    "rel_close_family",
    "rel_extended_family",
    "rel_friend",
    "rel_colleague",
    "distance_km_normalized",
    "rsvp_yes",
    "rsvp_no",
    "rsvp_maybe",
    "rsvp_pending",
    "ceremony_sangeet",
    "ceremony_mehndi",
    "ceremony_wedding",
    "ceremony_reception",
    "historical_attendance_rate",
]

RELATIONSHIP_TYPES = ["close_family", "extended_family", "friend", "colleague"]
RSVP_RESPONSES = ["yes", "no", "maybe", "pending"]
CEREMONY_TYPES = ["sangeet", "mehndi", "wedding", "reception"]

_AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = _AI_SERVICE_ROOT / "data"
MODELS_DIR = _AI_SERVICE_ROOT / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "faq_model.pkl"
DEFAULT_METADATA_PATH = MODELS_DIR / "faq_metadata.json"
DEFAULT_CSV_PATH = DATA_DIR / "faq_synthetic.csv"

MODEL_VERSION = "faq-v1.0"


def _generate_label(
    rsvp: str,
    relationship: str,
    distance_km: float,
    ceremony: str,
    historical_rate: float,
    rng: np.random.Generator,
) -> int:
    """
    Deterministic label generator per plan spec.
    """
    # RSVP base
    if rsvp == "yes":
        base = 0.92
    elif rsvp == "no":
        base = 0.04
    elif rsvp == "maybe":
        base = 0.55
    else:  # pending
        base = historical_rate * 0.70 + 0.15

    # Relationship adjustment
    if relationship == "close_family":
        base += 0.06
    elif relationship == "extended_family":
        base += 0.02
    elif relationship == "colleague":
        base -= 0.05

    # Distance adjustments
    if distance_km > 800:
        base -= 0.10
    if distance_km > 300 and rsvp == "maybe":
        base -= 0.08

    # Ceremony adjustments
    if ceremony == "wedding":
        base += 0.05
    elif ceremony == "sangeet":
        base -= 0.03

    # Noise
    base += rng.normal(0, 0.07)
    base = float(np.clip(base, 0.02, 0.98))
    return int(base > 0.50)


def generate_synthetic_data(
    n: int = 2000,
    seed: int = 42,
    save_csv: bool = True,
    csv_path: str | Path | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate reproducible synthetic FAQ dataset. Returns (X, y).

    X: shape (n, 14), feature matrix.
    y: shape (n,), binary {0, 1}.
    """
    rng = np.random.default_rng(seed)

    X_rows: list[list[float]] = []
    y_labels: list[int] = []

    for _ in range(n):
        relationship = RELATIONSHIP_TYPES[rng.integers(0, len(RELATIONSHIP_TYPES))]
        distance_km = float(rng.uniform(0, 2000))
        rsvp = RSVP_RESPONSES[rng.integers(0, len(RSVP_RESPONSES))]
        ceremony = CEREMONY_TYPES[rng.integers(0, len(CEREMONY_TYPES))]
        historical_rate = float(rng.uniform(0, 1)) if rng.random() > 0.3 else 0.5

        # Build 14-dim feature vector
        # Relationship one-hot (indices 0-3)
        rel_oh = [
            1.0 if relationship == "close_family" else 0.0,
            1.0 if relationship == "extended_family" else 0.0,
            1.0 if relationship == "friend" else 0.0,
            1.0 if relationship == "colleague" else 0.0,
        ]
        # Distance normalized (index 4)
        dist_norm = min(distance_km, 1500.0) / 1500.0

        # RSVP one-hot (indices 5-8)
        rsvp_oh = [
            1.0 if rsvp == "yes" else 0.0,
            1.0 if rsvp == "no" else 0.0,
            1.0 if rsvp == "maybe" else 0.0,
            1.0 if rsvp == "pending" else 0.0,
        ]
        # Ceremony one-hot (indices 9-12)
        cer_oh = [
            1.0 if ceremony == "sangeet" else 0.0,
            1.0 if ceremony == "mehndi" else 0.0,
            1.0 if ceremony == "wedding" else 0.0,
            1.0 if ceremony == "reception" else 0.0,
        ]
        # Historical attendance rate (index 13)
        hist = [historical_rate]

        row = rel_oh + [dist_norm] + rsvp_oh + cer_oh + hist
        X_rows.append(row)

        label = _generate_label(rsvp, relationship, distance_km, ceremony, historical_rate, rng)
        y_labels.append(label)

    X = np.array(X_rows, dtype=np.float64)
    y = np.array(y_labels, dtype=np.int64)

    if save_csv:
        target = Path(csv_path) if csv_path is not None else DEFAULT_CSV_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        header = ",".join(FEATURE_NAMES + ["label"])
        np.savetxt(
            target,
            np.hstack([X, y.reshape(-1, 1)]),
            delimiter=",",
            header=header,
            comments="",
            fmt="%.6f",
        )

    return X, y


def train_model(
    save_path: str | Path = DEFAULT_MODEL_PATH,
    metadata_path: str | Path | None = None,
    n: int = 2000,
    seed: int = 42,
) -> dict:
    """
    Generate synthetic data, fit a CalibratedClassifierCV (sigmoid, cv=5) wrapping
    GradientBoostingClassifier(n_estimators=100, max_depth=3). Also keep the plain
    GBM for feature_importances_. Persist bundle + metadata.

    Returns metrics dict.
    """
    save_path = Path(save_path)
    metadata_path = (
        Path(metadata_path)
        if metadata_path is not None
        else save_path.with_name("faq_metadata.json")
    )
    save_path.parent.mkdir(parents=True, exist_ok=True)

    X, y = generate_synthetic_data(n=n, seed=seed)

    # Inner GBM — kept for feature_importances_
    inner_gbm = GradientBoostingClassifier(
        n_estimators=100, max_depth=3, random_state=42
    )

    # Calibrated wrapper for realistic probabilities
    calibrated = CalibratedClassifierCV(estimator=inner_gbm, cv=5, method="sigmoid")
    calibrated.fit(X, y)

    # Fit a plain GBM on full data just for feature_importances_
    plain_gbm = GradientBoostingClassifier(
        n_estimators=100, max_depth=3, random_state=42
    )
    plain_gbm.fit(X, y)

    proba = calibrated.predict_proba(X)[:, 1]
    preds = (proba >= 0.5).astype(np.int64)
    metrics = {
        "accuracy": float(accuracy_score(y, preds)),
        "auc_roc": float(roc_auc_score(y, proba)),
        "brier_score": float(brier_score_loss(y, proba)),
        "n_samples": int(X.shape[0]),
        "n_features": int(X.shape[1]),
        "positive_rate": float(y.mean()),
    }

    feature_groups = {
        "relationship_type": [0, 1, 2, 3],
        "distance": [4],
        "rsvp_response": [5, 6, 7, 8],
        "ceremony_type": [9, 10, 11, 12],
        "historical_attendance_rate": [13],
    }

    bundle = {
        "calibrated": calibrated,
        "feature_importances": plain_gbm.feature_importances_.tolist(),
        "feature_names": FEATURE_NAMES,
        "feature_groups": feature_groups,
        "version": MODEL_VERSION,
    }
    joblib.dump(bundle, save_path)

    metadata = {
        "version": MODEL_VERSION,
        "feature_names": FEATURE_NAMES,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "seed": seed,
        "calibration": {"method": "sigmoid", "cv": 5},
    }
    metadata_path.write_text(json.dumps(metadata, indent=2))

    return metrics


if __name__ == "__main__":
    print(train_model())
