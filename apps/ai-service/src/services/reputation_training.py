"""
Reputation Score synthetic data generation + sklearn LogisticRegression trainer.

Mirrors the DPI pattern. The classifier is informational only; admin tooling
should always render the disclaimer. Feature names map 1:1 to the normalized
fields on ReputationFeatures (schemas/reputation.py).

Label rule (per spec) — applied to each row's normalized feature vector:

  base = 0.50
  if response_rate           > 0.7  : base += 0.20
  elif response_rate         < 0.3  : base -= 0.30
  if message_response_rate   > 0.6  : base += 0.15
  elif message_response_rate < 0.2  : base -= 0.20
  if avg_response_time_hours < 0.1  : base += 0.10
  elif avg_response_time_hours > 0.6: base -= 0.10
  if ghost_count             > 0.3  : base -= 0.25
  if consistency_score       > 0.7  : base += 0.05
  base += N(0, 0.06); clip(0.02, 0.98); label = base > 0.55
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
    "response_rate",
    "message_response_rate",
    "avg_response_time_hours",
    "ghost_count",
    "consistency_score",
]

LABEL_THRESHOLD = 0.55
NOISE_STD = 0.06

_AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = _AI_SERVICE_ROOT / "data"
MODELS_DIR = _AI_SERVICE_ROOT / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "reputation_model.pkl"
DEFAULT_METADATA_PATH = MODELS_DIR / "reputation_metadata.json"
DEFAULT_CSV_PATH = DATA_DIR / "reputation_synthetic.csv"

MODEL_VERSION = "1.0.0"


def _sample_features(n: int, rng: np.random.Generator) -> np.ndarray:
    """Mix three behavioural profiles so the label boundary is non-degenerate."""
    n_low = int(round(n * 0.30))   # ghosters / low responders
    n_mid = int(round(n * 0.45))
    n_high = n - n_low - n_mid     # trusted, responsive users
    n_features = len(FEATURE_NAMES)

    # Low-trust profile: low response_rate, low msg_response, slow time,
    # high ghosts, moderate consistency.
    low = np.column_stack([
        rng.beta(2.0, 6.0, n_low),   # response_rate
        rng.beta(2.0, 6.0, n_low),   # message_response_rate
        rng.beta(6.0, 2.0, n_low),   # avg_response_time_hours (slow)
        rng.beta(5.0, 3.0, n_low),   # ghost_count (high)
        rng.beta(3.0, 3.0, n_low),   # consistency_score
    ])
    mid = rng.beta(4.0, 4.0, size=(n_mid, n_features))
    # High-trust profile: high response_rate, high msg_response, fast time,
    # low ghosts, high consistency.
    high = np.column_stack([
        rng.beta(7.0, 2.0, n_high),
        rng.beta(7.0, 2.0, n_high),
        rng.beta(2.0, 6.0, n_high),
        rng.beta(2.0, 7.0, n_high),
        rng.beta(6.0, 2.0, n_high),
    ])

    X = np.vstack([low, mid, high])
    rng.shuffle(X, axis=0)
    return X.astype(np.float64)


def _generate_labels(X: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Apply the spec's rule-based scorer per row, then noise + threshold."""
    rr, mrr, art, gc, cs = X[:, 0], X[:, 1], X[:, 2], X[:, 3], X[:, 4]
    base = np.full(X.shape[0], 0.50)

    base += np.where(rr > 0.7, 0.20, 0.0)
    base += np.where(rr < 0.3, -0.30, 0.0)
    base += np.where(mrr > 0.6, 0.15, 0.0)
    base += np.where(mrr < 0.2, -0.20, 0.0)
    base += np.where(art < 0.1, 0.10, 0.0)
    base += np.where(art > 0.6, -0.10, 0.0)
    base += np.where(gc > 0.3, -0.25, 0.0)
    base += np.where(cs > 0.7, 0.05, 0.0)

    base += rng.normal(0.0, NOISE_STD, size=base.shape)
    base = np.clip(base, 0.02, 0.98)
    return (base > LABEL_THRESHOLD).astype(np.int64)


def generate_synthetic_data(
    n: int = 1500,
    seed: int = 42,
    save_csv: bool = True,
    csv_path: str | Path | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproducible synthetic dataset. Returns (X, y)."""
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
    Fit CalibratedClassifierCV(sigmoid, cv=5) wrapping LogisticRegression for
    well-calibrated probabilities. Fit a separate plain LogisticRegression on
    the full dataset whose coef_ is used for factor_contributions. Persist
    both in one joblib bundle alongside a metadata JSON.
    """
    save_path = Path(save_path)
    metadata_path = (
        Path(metadata_path)
        if metadata_path is not None
        else save_path.with_name("reputation_metadata.json")
    )
    save_path.parent.mkdir(parents=True, exist_ok=True)

    X, y = generate_synthetic_data(n=n, seed=seed)

    base = LogisticRegression(C=1.0, max_iter=1000)
    calibrated = CalibratedClassifierCV(estimator=base, cv=5, method="sigmoid")
    calibrated.fit(X, y)

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
