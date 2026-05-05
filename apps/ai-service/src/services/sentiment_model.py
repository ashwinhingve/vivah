"""
HuggingFace sentiment pipeline loader for Emotional Score (Phase 3 Week 10 Step 2).

Module-level singleton — model loads once on first explicit call to
``load_sentiment_pipeline()`` and is reused for the lifetime of the process.

Model: cardiffnlp/twitter-xlm-roberta-base-sentiment
  - Multilingual (Hindi, Hinglish, English).
  - 3-class sentiment: positive / neutral / negative.
  - ~1GB weights, downloaded to ~/.cache/huggingface/ on first call.

Failure mode: any import or load error logs and returns None. Callers MUST
handle the None case (fall back to neutral sentiment). The /health endpoint
calls ``is_pipeline_loaded()`` which never triggers a load.
"""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger("ai-service.sentiment")

_MODEL_NAME = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
_pipeline: Any | None = None
_load_attempted: bool = False


def load_sentiment_pipeline() -> Any | None:
    """
    Return the sentiment pipeline, loading it on first call.

    First call downloads ~1GB of model weights (2–5 min on cold cache).
    Subsequent calls return the cached pipeline instantly.

    Returns None if transformers/torch import fails or model load fails.
    Never raises — degrade gracefully so the service stays up.
    """
    global _pipeline, _load_attempted
    if _load_attempted:
        return _pipeline
    _load_attempted = True
    try:
        from transformers import pipeline

        _pipeline = pipeline(
            "sentiment-analysis",
            model=_MODEL_NAME,
            device=-1,  # CPU only — no GPU on Railway.
        )
        log.info("sentiment_model_loaded", model=_MODEL_NAME)
    except Exception as exc:  # noqa: BLE001
        log.error("sentiment_model_load_failed", model=_MODEL_NAME, error=str(exc))
        _pipeline = None
    return _pipeline


def is_pipeline_loaded() -> bool:
    """
    Cheap status check for /health — does NOT trigger a model load.

    Returns True only after a successful ``load_sentiment_pipeline()`` call.
    Returns False before any load attempt and after a failed attempt.
    """
    return _pipeline is not None
