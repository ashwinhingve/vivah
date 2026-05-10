"""
Stay Quotient orchestrator.

Trivial wrapper around stay_model.predict() — no LLM, no async I/O. The async
signature is preserved so callers can await it like the other AI services.
"""
from __future__ import annotations

from src.schemas.stay import (
    MODEL_VERSION,
    RECOMMENDED_ACTIONS,
    StayFactorContribution,
    StayRequest,
    StayResponse,
)
from src.services.stay_model import predict


async def compute_stay(request: StayRequest) -> StayResponse:
    raw = request.model_dump(exclude={"user_id"})
    result = predict(raw)

    contributions = [
        StayFactorContribution(factor=name, contribution=value)
        for name, value in result["factor_contributions"].items()
    ]

    primary_signal = result["primary_signal"]
    recommended_action = RECOMMENDED_ACTIONS.get(
        primary_signal,
        "Review user activity manually",
    )

    score = max(0.0, min(1.0, float(result["score"])))

    return StayResponse(
        user_id=request.user_id,
        churn_probability=score,
        risk_band=result["risk_band"],
        primary_signal=primary_signal,
        recommended_action=recommended_action,
        feature_contributions=contributions,
        model_version=MODEL_VERSION,
    )
