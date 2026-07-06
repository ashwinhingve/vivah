"""Profile embedding router.

Route: POST /ai/embedding/profile — turn assembled profile text into a 768-dim
vector. Protected by X-Internal-Key (global middleware + per-route Depends).
Called by the Node api's embedding-generation Bull job, never by end users.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.embedding import EmbeddingRequest, EmbeddingResponse
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
