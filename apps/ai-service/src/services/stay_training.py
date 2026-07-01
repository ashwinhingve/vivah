"""
Stay Quotient synthetic data generation + sklearn LogisticRegression trainer.

Predicts likelihood of user churn within the next 14 days. Mirrors DPI bundle
shape (calibrated + explainer) so feature contributions stay interpretable.

Model is a *structured opinion* — not a deterministic prediction. UI/admin
panel must always disclose this is an estimated risk score.
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
    "days_since_last_login",
    "messages_sent_last_7d",
    "profile_views_received_7d",
    "matches_accepted_total",
    "profile_completeness",
    "days_since_signup",
    "has_active_match_request",
]

# Per-feature normalization caps. Raw values divided by these to land in [0, 1].
# Stored at module scope so the predict() pipeline reuses the same constants.
FEATURE_CAPS: dict[str, float] = {
    "days_since_last_login": 30.0,
    "messages_sent_last_7d": 50.0,
    "profile_views_received_7d": 20.0,
    "matches_accepted_total": 10.0,
    "profile_completeness": 100.0,
    "days_since_signup": 90.0,
    "has_active_match_request": 1.0,
}

_AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = _AI_SERVICE_ROOT / "data"
MODELS_DIR = _AI_SERVICE_ROOT / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "stay_model.pkl"
DEFAULT_METADATA_PATH = MODELS_DIR / "stay_metadata.json"
DEFAULT_CSV_PATH = DATA_DIR / "stay_synthetic.csv"

MODEL_VERSION = "stay-v1.0"


def normalize_features(raw: dict[str, float | int | bool]) -> dict[str, float]:
    """
    Clamp + scale a raw feature dict to [0, 1] using FEATURE_CAPS.

    Used by both training (synthetic data already lives in [0, 1] but the
    label generator reads raw cap-aware thresholds) and predict() at
    inference time.
    """
    out: dict[str, float] = {}
    for name, cap in FEATURE_CAPS.items():
        v = raw.get(name, 0)
        if isinstance(v, bool):
            v = 1.0 if v else 0.0
        v = float(v)
        v = max(0.0, min(v, cap))
        out[name] = v / cap if cap > 0 else 0.0
    return out


def _sample_features(n: int, rng: np.random.Generator) -> np.ndarray:
    """
    Draw an (n, 7) feature matrix with three engagement profiles mixed:
      40 % engaged    → Beta(2, 8)  (low recency-gap, high activity)
      35 % medium     → Beta(4, 4)
      25 % disengaged → Beta(8, 2)  (high recency-gap, low activity)

    Features in [0, 1]. The has_active_match_request feature is binarized at
    0.5 to reflect its boolean nature.
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

    # Binarize the boolean feature (index 6 = has_active_match_request).
    X[:, 6] = (X[:, 6] >= 0.5).astype(np.float64)

    return X.astype(np.float64)


def _generate_labels(X: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """
    Apply the spec's churn-rule label generator over the normalized [0,1]
    feature matrix. Thresholds are written in normalized space (e.g.
    "days_since_last_login > 14 days" becomes "> 14/30 = 0.467").
    """
    days_since_last_login = X[:, 0]
    messages_sent_last_7d = X[:, 1]
    matches_accepted_total = X[:, 3]
    profile_completeness = X[:, 4]
    days_since_signup = X[:, 5]
    has_active_match_request = X[:, 6]

    base = np.full(X.shape[0], 0.30, dtype=np.float64)

    # Login recency
    base += np.where(days_since_last_login > 14.0 / 30.0, 0.45, 0.0)
    base += np.where(
        (days_since_last_login > 7.0 / 30.0) & (days_since_last_login <= 14.0 / 30.0),
        0.20,
        0.0,
    )
    base += np.where(days_since_last_login < 2.0 / 30.0, -0.20, 0.0)

    # Communication volume
    base += np.where(messages_sent_last_7d == 0.0, 0.15, 0.0)
    base += np.where(messages_sent_last_7d > 10.0 / 50.0, -0.15, 0.0)

    # Match traction at lifecycle boundary
    base += np.where(
        (matches_accepted_total == 0.0) & (days_since_signup > 30.0 / 90.0),
        0.20,
        0.0,
    )

    # Active commitment
    base += np.where(has_active_match_request == 1.0, -0.15, 0.0)

    # Profile completeness
    base += np.where(profile_completeness < 0.40, 0.15, 0.0)

    # Honeymoon period
    base += np.where(days_since_signup < 7.0 / 90.0, -0.10, 0.0)

    # Stochastic noise
    base += rng.normal(0.0, 0.08, size=base.shape)
    base = np.clip(base, 0.02, 0.98)

    return (base > 0.50).astype(np.int64)


def generate_synthetic_data(
    n: int = 1500,
    seed: int = 42,
    save_csv: bool = True,
    csv_path: str | Path | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Reproducible synthetic dataset. Returns (X, y).

    X: shape (n, 7), each value in [0, 1].
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
        else save_path.with_name("stay_metadata.json")
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
        "feature_caps": FEATURE_CAPS,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "seed": seed,
        "calibration": {"method": "sigmoid", "cv": 5},
    }
    metadata_path.write_text(json.dumps(metadata, indent=2))

    return metrics


if __name__ == "__main__":
    print(train_model())
