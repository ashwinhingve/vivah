"""
Stay Quotient (churn risk) router.

Route: POST /ai/stay/predict

Protected by X-Internal-Key (both global middleware + per-route Depends).
Returns a StayResponse with churn probability, risk band, and recommended
admin action.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.stay import StayRequest, StayResponse
from src.services.stay_service import compute_stay

router = APIRouter(prefix="/ai/stay", tags=["stay"])


@router.post(
    "/predict",
    response_model=StayResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def predict_stay(request: StayRequest) -> StayResponse:
    """
    Predict churn risk for a single user.

    - Calls stay_model.predict() for the calibrated sklearn probability.
    - Pure ML — no LLM, no external network call.
    - Admin-only feature; no public UI consumes this directly.
    """
    return await compute_stay(request)
