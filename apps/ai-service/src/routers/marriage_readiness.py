"""
Marriage Readiness router.

Route: POST /ai/marriage-readiness/score

Protected by X-Internal-Key (global middleware + per-route Depends).
Returns a MarriageReadinessResponse with readiness_score, dimension
breakdown, and next_actions. Rule-based — no ML model.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.marriage_readiness import (
    MarriageReadinessRequest,
    MarriageReadinessResponse,
)
from src.services.marriage_readiness_service import compute_marriage_readiness


router = APIRouter(prefix="/ai/marriage-readiness", tags=["marriage-readiness"])


@router.post(
    "/score",
    response_model=MarriageReadinessResponse,
    dependencies=[Depends(verify_internal_key)],
)
def score_readiness(request: MarriageReadinessRequest) -> MarriageReadinessResponse:
    return compute_marriage_readiness(request)
