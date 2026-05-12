"""
Profile Optimizer router.

Route: POST /ai/profile-optimizer/score

Protected by X-Internal-Key (global middleware + per-route Depends).
Returns a ProfileOptimizerResponse with overall_score, tier, dimension
scores, and field_suggestions. Rule-based — no ML model involved.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.profile_optimizer import (
    ProfileOptimizerRequest,
    ProfileOptimizerResponse,
)
from src.services.profile_optimizer_service import compute_profile_optimizer


router = APIRouter(prefix="/ai/profile-optimizer", tags=["profile-optimizer"])


@router.post(
    "/score",
    response_model=ProfileOptimizerResponse,
    dependencies=[Depends(verify_internal_key)],
)
def score_profile(request: ProfileOptimizerRequest) -> ProfileOptimizerResponse:
    return compute_profile_optimizer(request)
