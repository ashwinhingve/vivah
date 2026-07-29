"""Embedding router.

Routes (both X-Internal-Key protected, called by the Node api only):
  POST /ai/embedding/profile — assembled profile text → 768-dim vector
      (embedding-generation Bull job).
  POST /ai/embedding/batch   — up to 64 texts → 768-dim vectors, same order
      (knowledge-indexing Bull job + the assistant's search_knowledge query).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.embedding import (
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)
from src.services.embedding_model import EMBEDDING_DIMS, embed_texts
from src.services.embedding_service import generate_profile_embedding

router = APIRouter(prefix="/ai/embedding", tags=["embedding"])


@router.post(
    "/profile",
    response_model=EmbeddingResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def embed_profile(request: EmbeddingRequest) -> EmbeddingResponse:
    """Generate a profile embedding. Returns available=False if the model is down."""
    return generate_profile_embedding(request)


@router.post(
    "/batch",
    response_model=BatchEmbeddingResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def embed_batch(request: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    """Embed a batch of texts. Returns available=False if the model is down."""
    vecs = embed_texts(request.texts)
    if vecs is None:
        return BatchEmbeddingResponse(embeddings=[], dims=0, available=False)
    return BatchEmbeddingResponse(embeddings=vecs, dims=EMBEDDING_DIMS, available=True)
