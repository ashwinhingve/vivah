"""
Reputation Score service — orchestrates the model prediction and packages the
response for the admin endpoint. No LLM call (admin-only feature, deterministic
output).
"""

from __future__ import annotations

import structlog

from src.schemas.reputation import (
    DISCLAIMER,
    ReputationFactorContribution,
    ReputationRequest,
    ReputationResponse,
)
from src.services.reputation_model import FEATURE_NAMES, predict


log = structlog.get_logger("ai-service.reputation")


# Strength labels — descriptive of *why* the user scores well.
_STRENGTH_LABELS: dict[str, str] = {
    "response_rate":           "high_acceptance",
    "message_response_rate":   "chatty_replier",
    "avg_response_time_hours": "fast_responder",
    "ghost_count":             "loyal_engager",
    "consistency_score":       "steady_user",
}

# Concern labels — descriptive of *why* the user scores poorly.
_CONCERN_LABELS: dict[str, str] = {
    "response_rate":           "low_acceptance",
    "message_response_rate":   "slow_replier",
    "avg_response_time_hours": "slow_responder",
    "ghost_count":             "ghoster",
    "consistency_score":       "erratic_activity",
}


def _direction(contribution: float) -> str:
    if contribution > 0.02:
        return "protective"
    if contribution < -0.02:
        return "concern"
    return "neutral"


def compute_reputation(request: ReputationRequest) -> ReputationResponse:
    feature_dict = {
        "response_rate":           request.features.response_rate,
        "message_response_rate":   request.features.message_response_rate,
        "avg_response_time_hours": request.features.avg_response_time_hours_norm,
        "ghost_count":             request.features.ghost_count_norm,
        "consistency_score":       request.features.consistency_score,
    }

    result = predict(feature_dict)

    contributions: dict[str, float] = result["factor_contributions"]
    score_int: int = result["score_int"]
    tier: str = result["tier"]

    # Pick strength = argmax positive contribution; concern = argmin negative.
    sorted_by_contrib = sorted(contributions.items(), key=lambda kv: kv[1], reverse=True)
    top_factor, top_value = sorted_by_contrib[0]
    bottom_factor, bottom_value = sorted_by_contrib[-1]

    primary_strength = _STRENGTH_LABELS.get(top_factor, top_factor)
    primary_concern: str | None
    if bottom_value < -0.02 and tier in {"silver", "bronze", "flagged"}:
        primary_concern = _CONCERN_LABELS.get(bottom_factor, bottom_factor)
    else:
        primary_concern = None

    factor_list = [
        ReputationFactorContribution(
            factor=name,
            contribution=round(contributions[name], 6),
            direction=_direction(contributions[name]),
        )
        for name in FEATURE_NAMES
    ]

    log.info(
        "reputation_computed",
        user_id=request.user_id,
        score=score_int,
        tier=tier,
        primary_strength=primary_strength,
        primary_concern=primary_concern,
    )

    return ReputationResponse(
        user_id=request.user_id,
        reputation_score=score_int,
        tier=tier,  # type: ignore[arg-type]
        ghost_count=request.ghost_count_raw,
        primary_strength=primary_strength,
        primary_concern=primary_concern,
        feature_contributions=factor_list,
        disclaimer=DISCLAIMER,
    )
