"""
Emotional Score router.

Route: POST /ai/emotional/score

Returns computed emotional health score for a chat conversation.
Pure ML inference — no LLM calls, deterministic computation.
Protected by X-Internal-Key (global middleware + per-route Depends).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.emotional import EmotionalScoreRequest, EmotionalScoreResponse
from src.services.emotional_service import compute_emotional_score

router = APIRouter(prefix="/ai/emotional", tags=["emotional"])


def get_pipeline():
    from src.services.sentiment_model import load_sentiment_pipeline
    return load_sentiment_pipeline()


@router.post(
    "/score",
    response_model=EmotionalScoreResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def score(
    request: EmotionalScoreRequest,
    pipeline=Depends(get_pipeline),
) -> EmotionalScoreResponse:
    """
    Compute emotional health score from conversation messages.

    - < 5 messages → returns neutral baseline (score=50, STEADY, stable).
    - pipeline=None (model unavailable) → sentiment sub-score falls back to 50.
    - Always returns a valid response, never 5xx on inference failure.
    """
    return await compute_emotional_score(request=request, pipeline=pipeline)
