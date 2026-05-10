"""
FAQ (Function Attendance Quotient) router.

Route: POST /ai/faq/predict

Protected by X-Internal-Key (both global middleware + per-route Depends).
Returns a FaqResponse with calibrated attendance probability, confidence band,
and per-feature contributions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.deps.auth import verify_internal_key
from src.schemas.faq import FaqRequest, FaqResponse
from src.services.faq_service import compute_faq

router = APIRouter(prefix="/ai/faq", tags=["faq"])


@router.post(
    "/predict",
    response_model=FaqResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def predict(request: FaqRequest) -> FaqResponse:
    """
    Predict attendance probability for a single guest+ceremony combination.

    - Accepts a structured FaqRequest with guest_id, ceremony_id, and features.
    - Returns calibrated probability (0..1), confidence band, and 14 feature contributions.
    - Protected by X-Internal-Key; only the Node API should call this endpoint.
    """
    return await compute_faq(request)
