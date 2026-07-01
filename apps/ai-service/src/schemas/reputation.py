"""
Pydantic schemas for the Reputation Score endpoint.

Reputation Score is an admin-only platform-wide trust indicator. It rewards
honest, responsive users and flags ghosting patterns. The classifier is a
CalibratedClassifierCV-wrapped LogisticRegression trained on synthetic data
(see services/reputation_training.py).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER: str = (
    "Reputation Score is computed from platform behavior signals over the "
    "last 30 days. It is informational only and may not reflect a user's "
    "intent or circumstances. Do not use as the sole basis for moderation "
    "decisions."
)

TIER_LABELS: dict[str, str] = {
    "platinum": "Highly Trusted",
    "gold":     "Trusted",
    "silver":   "Steady",
    "bronze":   "Watch",
    "flagged":  "At Risk",
}


class ReputationFeatures(BaseModel):
    """Normalized inputs to the classifier — all in [0,1]."""

    response_rate: float = Field(ge=0, le=1)
    message_response_rate: float = Field(ge=0, le=1)
    avg_response_time_hours_norm: float = Field(ge=0, le=1)
    ghost_count_norm: float = Field(ge=0, le=1)
    consistency_score: float = Field(ge=0, le=1)


class ReputationRequest(BaseModel):
    user_id: str = Field(min_length=1)
    features: ReputationFeatures
    ghost_count_raw: int = Field(default=0, ge=0)


class ReputationFactorContribution(BaseModel):
    factor: str
    contribution: float
    direction: Literal["protective", "concern", "neutral"]


class ReputationResponse(BaseModel):
    user_id: str
    reputation_score: int = Field(ge=0, le=100)
    tier: Literal["platinum", "gold", "silver", "bronze", "flagged"]
    ghost_count: int
    primary_strength: str
    primary_concern: str | None
    feature_contributions: list[ReputationFactorContribution]
    disclaimer: str = DISCLAIMER
