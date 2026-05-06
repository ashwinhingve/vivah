"""
DPI (Divorce Probability Indicator) schemas.

Pydantic models for request/response validation.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER = (
    "This analysis reflects compatibility patterns from comparable profiles. "
    "Every relationship is unique. Use as one input among many."
)

LEVEL_LABELS: dict[str, str] = {
    "LOW": "Strong Foundation",
    "MEDIUM": "Some Areas to Discuss",
    "HIGH": "Important Conversations Needed",
}


class DpiFeatures(BaseModel):
    age_gap_years: float = Field(ge=0, le=1)
    education_gap: float = Field(ge=0, le=1)
    income_disparity_pct: float = Field(ge=0, le=1)
    family_values_alignment: float = Field(ge=0, le=1)
    lifestyle_compatibility: float = Field(ge=0, le=1)
    communication_score: float = Field(ge=0, le=1)
    guna_milan_score: float = Field(ge=0, le=1)
    geographic_distance_km: float = Field(ge=0, le=1)
    religion_caste_match: float = Field(ge=0, le=1)
    preference_match_pct: float = Field(ge=0, le=1)


class DpiRequest(BaseModel):
    requesting_user_id: str
    match_id: str
    features: DpiFeatures
    profile_a_summary: str = Field(default="", max_length=500)
    profile_b_summary: str = Field(default="", max_length=500)
    shared_strengths: list[str] = Field(default_factory=list)


class DpiFactorContribution(BaseModel):
    factor: str
    contribution: float
    direction: Literal["protective", "concern", "neutral"]


class DpiResponse(BaseModel):
    score: float = Field(ge=0, le=1)
    level: Literal["LOW", "MEDIUM", "HIGH"]
    label: str
    narrative: str
    suggestion: str
    top_factors: list[DpiFactorContribution]
    disclaimer: str
