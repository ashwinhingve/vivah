"""
DPI (Divorce Probability Indicator) router.

Route: POST /ai/dpi/compute

Protected by X-Internal-Key (both global middleware + per-route Depends).
Returns a DpiResponse with score, level, label, Opus narrative, and top factors.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.dpi import DpiRequest, DpiResponse
from src.services.dpi_service import compute_dpi
from src.services.llm_client import ai_mock_enabled

router = APIRouter(prefix="/ai/dpi", tags=["dpi"])


@router.post(
    "/compute",
    response_model=DpiResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def compute(request: DpiRequest) -> DpiResponse:
    """
    Compute DPI score + Opus-generated narrative for a profile pair.

    - Calls dpi_model.predict() for calibrated sklearn probability.
    - Mock only when no provider key is set / AI_FORCE_MOCK (NOT USE_MOCK_SERVICES).
    - In live mode, calls the configured provider (Gemini/Claude) for the narrative.
    - On any error, gracefully falls back to mock narrative — never 5xx the caller.
    - Forbidden words in LLM output trigger automatic fallback to mock.
    """
    return await compute_dpi(
        request=request,
        anthropic_client=None,  # lazy singleton initialised inside dpi_service
        use_mock=ai_mock_enabled(),
    )
