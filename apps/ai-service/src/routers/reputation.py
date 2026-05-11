"""
Reputation Score router.

Route: POST /ai/reputation/predict

Protected by X-Internal-Key (global middleware + per-route Depends).
Returns a ReputationResponse with reputation_score (0-100), tier, and
factor contributions. No LLM call — deterministic sklearn output.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.reputation import ReputationRequest, ReputationResponse
from src.services.reputation_service import compute_reputation


router = APIRouter(prefix="/ai/reputation", tags=["reputation"])


@router.post(
    "/predict",
    response_model=ReputationResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def predict_reputation(request: ReputationRequest) -> ReputationResponse:
    return compute_reputation(request)
