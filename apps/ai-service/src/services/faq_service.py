"""
FAQ (Function Attendance Quotient) service — thin orchestrator.

No LLM calls. Bridges FastAPI router → faq_model.predict() and maps
to the FaqResponse schema.
"""
from __future__ import annotations

from src.schemas.faq import FaqContribution, FaqRequest, FaqResponse
from src.services.faq_model import predict


async def compute_faq(request: FaqRequest) -> FaqResponse:
    """
    Run the FAQ model for a single guest+ceremony prediction.

    Raises ValueError if feature encoding fails (malformed input that
    bypassed Pydantic validation should not reach here).
    """
    result = predict(request.model_dump(exclude={"guest_id", "ceremony_id"}))

    return FaqResponse(
        guest_id=request.guest_id,
        ceremony_id=request.ceremony_id,
        predicted_probability=result["predicted_probability"],
        confidence_band=result["confidence_band"],
        direction=result["direction"],
        feature_contributions=[
            FaqContribution(**c) for c in result["feature_contributions"]
        ],
        model_version=result["model_version"],
    )
