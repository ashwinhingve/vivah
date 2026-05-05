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
    - In mock mode (USE_MOCK_SERVICES=true), returns pre-set suggestions instantly.
    - In live mode, calls claude-sonnet-4-6 via Helicone proxy.
    - On any error, gracefully falls back to mock suggestions — never 5xx the caller.
    """
    import os

    use_mock = os.getenv("USE_MOCK_SERVICES", "true").lower() == "true"
    return await get_suggestions(
        request=request,
        redis_client=None,   # lazy singleton initialised inside coach_service
        anthropic_client=None,
        use_mock=use_mock,
    )
