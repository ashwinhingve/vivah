"""
Conversation Coach router.

Route: POST /ai/coach/suggest

Returns 3 AI-generated conversation suggestions for a matched pair.
Protected by X-Internal-Key (both global middleware + per-route Depends).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.coach import CoachRequest, CoachResponse
from src.services.coach_service import get_suggestions
from src.services.llm_client import ai_mock_enabled

router = APIRouter(prefix="/ai/coach", tags=["coach"])


@router.post(
    "/suggest",
    response_model=CoachResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def suggest(request: CoachRequest) -> CoachResponse:
    """
    Generate 3 culturally intelligent conversation suggestions for a matched pair.

    - Checks Redis cache first (TTL=3600).
    - Mock only when no provider key is set / AI_FORCE_MOCK (NOT USE_MOCK_SERVICES).
    - In live mode, calls the configured provider (Gemini/Claude) via the adapter.
    - On any error, gracefully falls back to mock suggestions — never 5xx the caller.
    """
    return await get_suggestions(
        request=request,
        redis_client=None,   # lazy singleton initialised inside coach_service
        anthropic_client=None,
        use_mock=ai_mock_enabled(),
    )
