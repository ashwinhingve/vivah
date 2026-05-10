"""
Stay Quotient (churn risk) schemas.

Pydantic models for request/response validation. Admin-only feature — no LLM,
no narrative; pure deterministic ML output + canned action template.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MODEL_VERSION = "stay-v1.0"

# Mapping primary_signal → recommended action template. Owned by the schema
# module so test_stay can assert exact strings without re-importing service.
RECOMMENDED_ACTIONS: dict[str, str] = {
    "days_since_last_login": "Send re-engagement notification: 'Your matches are waiting'",
    "messages_sent_last_7d": "Suggest conversation starters in chat",
    "profile_views_received_7d": "Recommend profile photo refresh",
    "matches_accepted_total": "Highlight new compatibility scores in feed",
    "profile_completeness": "Prompt for missing sections",
    "days_since_signup": "Onboarding nudge: highlight key features",
    "has_active_match_request": "Send notification: 'You have a pending request'",
}


class StayRequest(BaseModel):
    user_id: str
    days_since_last_login: float = Field(ge=0)
    messages_sent_last_7d: int = Field(ge=0)
    profile_views_received_7d: int = Field(ge=0)
    matches_accepted_total: int = Field(ge=0)
    profile_completeness: int = Field(ge=0, le=100)
    days_since_signup: int = Field(ge=0)
    has_active_match_request: bool


class StayFactorContribution(BaseModel):
    factor: str
    contribution: float


class StayResponse(BaseModel):
    user_id: str
    churn_probability: float = Field(ge=0, le=1)
    risk_band: Literal["low", "medium", "high", "critical"]
    primary_signal: str
    recommended_action: str
    feature_contributions: list[StayFactorContribution]
    model_version: str
