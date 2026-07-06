"""Local sentence-transformer embedding model (provider-independent).

Model: sentence-transformers/paraphrase-multilingual-mpnet-base-v2
  - 768-dim, multilingual (Hindi / Hinglish / English).
  - CPU-runnable (device=-1 / "cpu"), ~1GB weights cached on first load.

Deliberately LOCAL and decoupled from ``LLM_PROVIDER``: this is the only way to
keep embeddings model-agnostic (Anthropic has no embeddings API at all), and it
keeps profile text on our own infrastructure. Mirrors the lazy-singleton pattern
of sentiment_model.py.

Failure mode: any import/load error logs and leaves the model None. Callers must
handle None (skip embedding generation). Never raises — the service stays up.
"""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger("ai-service.embedding")

_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
EMBEDDING_DIMS = 768

_model: Any | None = None
_load_attempted: bool = False


def load_embedding_model() -> Any | None:
    """Return the SentenceTransformer model, loading it on first call.

    First call downloads ~1GB of weights (cold cache). Subsequent calls return
    the cached model instantly. Returns None on any import/load failure.
    """
    global _model, _load_attempted  # noqa: PLW0603
    if _load_attempted:
        return _model
    _load_attempted = True
    try:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(_MODEL_NAME, device="cpu")
        log.info("embedding_model_loaded", model=_MODEL_NAME)
    except Exception as exc:  # noqa: BLE001
        log.error("embedding_model_load_failed", model=_MODEL_NAME, error=str(exc))
        _model = None
    return _model


def is_model_loaded() -> bool:
    """Cheap /health status check — does NOT trigger a load."""
    return _model is not None


def embed_text(text: str) -> list[float] | None:
    """Embed one string into a 768-dim unit vector. Returns None if unavailable.

    Vectors are L2-normalized so a pgvector cosine-distance (``<=>``) search is
    equivalent to ranking by cosine similarity.
    """
    model = load_embedding_model()
    if model is None:
        return None
    cleaned = (text or "").strip()
    if not cleaned:
        return None
    try:
        vec = model.encode(cleaned, normalize_embeddings=True)
        return [float(x) for x in vec]
    except Exception as exc:  # noqa: BLE001
        log.error("embedding_encode_failed", error=str(exc))
        return None
