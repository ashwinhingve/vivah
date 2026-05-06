"""
DPI synthetic data generation + sklearn LogisticRegression trainer.

Phase 0 of Week 11 Step 1. The model is a *structured opinion* expressed as
logistic regression — it does not predict divorce. UI must always disclose this.

See docs/superpowers/plans/week11-step1-dpi-plan.md, Decisions 1-3, for the
underlying design choices.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score


FEATURE_NAMES: list[str] = [
    "age_gap_years",
    "education_gap",
    "income_disparity_pct",
    "family_values_alignment",
    "lifestyle_compatibility",
    "communication_score",
    "guna_milan_score",
    "geographic_distance_km",
    "religion_caste_match",
    "preference_match_pct",
]

# Per-feature risk weight applied during synthetic label generation. These are
# NOT the model's eventual coefficients — the model learns them from the data.
# All weights reduced ~30 % vs the initial pass to fuzz the label boundary so
# the calibrated model produces realistic mid-range probabilities instead of
# saturating to 0/1 on synthetic extremes.
LABEL_WEIGHTS: dict[str, float] = {
    "age_gap_years": 0.051,
    "education_gap": 0.076,
    "income_disparity_pct": 0.102,
    "family_values_alignment": 0.051,
    "lifestyle_compatibility": 0.051,
    "communication_score": 0.051,
    "guna_milan_score": 0.041,
    "geographic_distance_km": 0.025,
    "religion_caste_match": 0.051,
    "preference_match_pct": 0.051,
}

BASE_RISK = 0.22
NOISE_STD = 0.18
LABEL_THRESHOLD = 0.5

_AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = _AI_SERVICE_ROOT / "data"
MODELS_DIR = _AI_SERVICE_ROOT / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "dpi_model.pkl"
DEFAULT_METADATA_PATH = MODELS_DIR / "dpi_metadata.json"
DEFAULT_CSV_PATH = DATA_DIR / "dpi_synthetic.csv"

MODEL_VERSION = "1.0.0"


def _sample_features(n: int, rng: np.random.Generator) -> np.ndarray:
    """
    Draw an (n, 10) feature matrix with three risk profiles mixed:
      40 % low-risk  → Beta(2, 8)   (mean ≈ 0.20)
      35 % medium    → Beta(4, 4)   (mean ≈ 0.50)
      25 % high-risk → Beta(8, 2)   (mean ≈ 0.80)
    """
    n_low = int(round(n * 0.40))
    n_med = int(round(n * 0.35))
    n_high = n - n_low - n_med
    n_features = len(FEATURE_NAMES)

    low = rng.beta(2.0, 8.0, size=(n_low, n_features))
    med = rng.beta(4.0, 4.0, size=(n_med, n_features))
    high = rng.beta(8.0, 2.0, size=(n_high, n_features))

    X = np.vstack([low, med, high])
    rng.shuffle(X, axis=0)
    return X.astype(np.float64)


def _generate_labels(X: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    weights = np.array([LABEL_WEIGHTS[f] for f in FEATURE_NAMES], dtype=np.float64)
    risk = BASE_RISK + X @ weights
    risk = risk + rng.normal(0.0, NOISE_STD, size=risk.shape)
    return (risk > LABEL_THRESHOLD).astype(np.int64)


def generate_synthetic_data(
    n: int = 1500,
    seed: int = 42,
    save_csv: bool = True,
    csv_path: str | Path | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Reproducible synthetic dataset. Returns (X, y).

    X: shape (n, 10), each value in [0, 1].
    y: shape (n,), binary {0, 1}.
    """
    rng = np.random.default_rng(seed)
    X = _sample_features(n, rng)
    y = _generate_labels(X, rng)

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
    n: int = 1500,
    seed: int = 42,
) -> dict:
    """
    Generate data, fit a CalibratedClassifierCV (sigmoid, cv=5) wrapping
    LogisticRegression, plus a separate plain LogisticRegression on the full
    dataset that we keep for interpretable factor contributions. Persist both
    in one joblib bundle.

    Returns metrics dict computed from the calibrated predictor.
    """
    save_path = Path(save_path)
    metadata_path = (
        Path(metadata_path)
        if metadata_path is not None
        else save_path.with_name("dpi_metadata.json")
    )
    save_path.parent.mkdir(parents=True, exist_ok=True)

    X, y = generate_synthetic_data(n=n, seed=seed)

    # Predictor: calibrated probabilities so the final score is realistic
    # (not saturated near 0/1 on synthetic extremes).
    base = LogisticRegression(C=1.0, max_iter=1000)
    calibrated = CalibratedClassifierCV(estimator=base, cv=5, method="sigmoid")
    calibrated.fit(X, y)

    # Explainer: plain LR on full data — exposes coef_/intercept_ used for
    # factor_contributions in the predict() API. The calibrator wraps several
    # fold-fitted estimators and does not expose a stable single coef_.
    explainer = LogisticRegression(C=1.0, max_iter=1000)
    explainer.fit(X, y)

    proba = calibrated.predict_proba(X)[:, 1]
    preds = (proba >= 0.5).astype(np.int64)
    metrics = {
        "accuracy": float(accuracy_score(y, preds)),
        "auc_roc": float(roc_auc_score(y, proba)),
        "brier_score": float(brier_score_loss(y, proba)),
        "n_samples": int(X.shape[0]),
        "n_features": int(X.shape[1]),
        "positive_rate": float(y.mean()),
        "score_p05": float(np.quantile(proba, 0.05)),
        "score_p95": float(np.quantile(proba, 0.95)),
    }

    bundle = {"calibrated": calibrated, "explainer": explainer}
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
