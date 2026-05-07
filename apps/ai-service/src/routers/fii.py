"""
FII (Family Inclination Index) router.

Route: POST /ai/fii/compatibility

Protected by X-Internal-Key (both global middleware + per-route Depends).
Returns a FiiCompatibilityResponse with individual scores, delta,
compatibility label, template or Sonnet narrative, and discussion starter.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.fii import FiiCompatibilityRequest, FiiCompatibilityResponse
from src.services.fii_service import compute_compatibility

router = APIRouter(prefix="/ai/fii", tags=["fii"])


@router.post(
    "/compatibility",
    response_model=FiiCompatibilityResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def compatibility(request: FiiCompatibilityRequest) -> FiiCompatibilityResponse:
    """
    Compute FII compatibility for two profiles.

    - Scores each profile's family inclination (0-100).
    - Computes delta and compatibility label.
    - Returns template narrative by default.
    - In live mode (USE_MOCK_SERVICES=false) with use_llm_narrative=true,
      calls claude-sonnet-4-6 for a personalized narrative.
    - On any LLM error or forbidden-word hit, silently falls back to template.
    """
    use_mock = os.getenv("USE_MOCK_SERVICES", "true").lower() == "true"
    return await compute_compatibility(
        request=request,
        anthropic_client=None,  # lazy singleton initialised inside fii_service
        use_mock=use_mock,
    )
