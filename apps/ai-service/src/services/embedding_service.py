"""Profile embedding generation service.

Turns assembled profile text into a 768-dim vector via the local
sentence-transformer. Never raises: when the model is unavailable it returns an
``available=False`` response so the caller can skip persistence gracefully.
"""

from __future__ import annotations

import structlog

from src.schemas.embedding import EmbeddingRequest, EmbeddingResponse
from src.services.embedding_model import EMBEDDING_DIMS, embed_text

log = structlog.get_logger("embedding-service")


def generate_profile_embedding(request: EmbeddingRequest) -> EmbeddingResponse:
    vec = embed_text(request.text)
    if vec is None:
        log.warning("embedding_unavailable", profile_id=request.profile_id)
        return EmbeddingResponse(
            profile_id=request.profile_id, embedding=[], dims=0, available=False
        )
    if len(vec) != EMBEDDING_DIMS:
        # Defensive: model changed dimension unexpectedly — do not persist.
        log.error("embedding_dim_mismatch", got=len(vec), expected=EMBEDDING_DIMS)
        return EmbeddingResponse(
            profile_id=request.profile_id, embedding=[], dims=len(vec), available=False
        )
    return EmbeddingResponse(
        profile_id=request.profile_id, embedding=vec, dims=len(vec), available=True
    )
