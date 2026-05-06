"""
DPI (Divorce Probability Indicator) router.

Route: POST /ai/dpi/compute

Protected by X-Internal-Key (both global middleware + per-route Depends).
Returns a DpiResponse with score, level, label, Opus narrative, and top factors.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.dpi import DpiRequest, DpiResponse
from src.services.dpi_service import compute_dpi

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
    - In mock mode (USE_MOCK_SERVICES=true), returns pre-set narrative instantly.
    - In live mode, calls claude-opus-4-7 via Helicone proxy.
    - On any error, gracefully falls back to mock narrative — never 5xx the caller.
    - Forbidden words in LLM output trigger automatic fallback to mock.
    """
    use_mock = os.getenv("USE_MOCK_SERVICES", "true").lower() == "true"
    return await compute_dpi(
        request=request,
        anthropic_client=None,  # lazy singleton initialised inside dpi_service
        use_mock=use_mock,
    )
